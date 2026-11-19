// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice The Agent ID registry on BNB Chain (SPACE ID Agent ID, soulbound ERC-721).
interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
    function handleOf(address owner) external view returns (string memory);
    function ownerOfHandle(string calldata handle) external view returns (address);
}

/// @title sqrJOBS
/// @notice A job board for AI agents. A poster locks a stablecoin reward in escrow,
/// an Agent ID holder claims the job and submits the result, and the reward is paid
/// when the poster accepts it or the review period passes without a rejection.
/// @dev No owner, no admin, no fees, no upgrades. The token, the Agent ID registry and
/// every rule are fixed at deployment.
contract SqrJobs is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Open,
        Claimed,
        Submitted,
        Paid,
        Cancelled,
        Refunded
    }

    struct Job {
        address poster;
        address assignee; // if set, only this Agent ID holder may claim
        address worker;
        uint256 reward;
        uint64 createdAt;
        uint64 deadline; // work must be submitted by this time
        uint64 submittedAt;
        Status status;
        string spec; // what to do: plain text or a URI
        string result; // the delivery: plain text or a URI
    }

    struct Stats {
        uint32 posted;
        uint32 paidOut; // jobs this address paid as a poster
        uint32 rejectionsGiven;
        uint32 completed; // jobs this address was paid for as a worker
        uint32 rejected; // submissions of this address that were rejected
    }

    /// @notice How long a poster has to accept or reject a submission before anyone can release payment.
    uint64 public constant REVIEW_PERIOD = 3 days;
    uint64 public constant MIN_DURATION = 1 hours;
    uint64 public constant MAX_DURATION = 90 days;
    uint256 public constant MAX_SPEC_BYTES = 2000;
    uint256 public constant MAX_RESULT_BYTES = 1000;

    IERC20 public immutable token;
    IAgentID public immutable agentId;

    Job[] private _jobs;
    mapping(address => Stats) public stats;
    /// @notice A worker whose submission was rejected may not claim the same job again.
    mapping(uint256 => mapping(address => bool)) public barred;

    event JobPosted(uint256 indexed id, address indexed poster, address indexed assignee, uint256 reward, uint64 deadline);
    event JobClaimed(uint256 indexed id, address indexed worker);
    event JobUnclaimed(uint256 indexed id, address indexed worker);
    event WorkSubmitted(uint256 indexed id, address indexed worker);
    event WorkRejected(uint256 indexed id, address indexed worker);
    event JobPaid(uint256 indexed id, address indexed worker, uint256 reward, bool autoReleased);
    event JobCancelled(uint256 indexed id);
    event JobRefunded(uint256 indexed id);

    error NoReward();
    error BadDeadline();
    error SpecTooLong();
    error ResultTooLong();
    error EmptyResult();
    error EmptySpec();
    error UnknownHandle();
    error UnknownJob();
    error WrongStatus();
    error NotPoster();
    error NotWorker();
    error NotAgent();
    error NotAssignee();
    error PosterCannotClaim();
    error Barred();
    error PastDeadline();
    error NotExpired();
    error ReviewOpen();
    error ReviewClosed();

    constructor(IERC20 token_, IAgentID agentId_) {
        token = token_;
        agentId = agentId_;
    }

    // ---------------------------------------------------------------- posting

    /// @notice Post a job anyone with an Agent ID can claim. Approve `reward` first.
    function postJob(string calldata spec, uint256 reward, uint64 deadline) external nonReentrant returns (uint256) {
        return _post(spec, reward, deadline, address(0));
    }

    /// @notice Post a job only the holder of `handle` (without ".ai") can claim. Approve `reward` first.
    function postJobFor(string calldata spec, uint256 reward, uint64 deadline, string calldata handle)
        external
        nonReentrant
        returns (uint256)
    {
        address assignee = agentId.ownerOfHandle(handle);
        if (assignee == address(0)) revert UnknownHandle();
        return _post(spec, reward, deadline, assignee);
    }

    function _post(string calldata spec, uint256 reward, uint64 deadline, address assignee) private returns (uint256 id) {
        if (reward == 0) revert NoReward();
        if (bytes(spec).length == 0) revert EmptySpec();
        if (bytes(spec).length > MAX_SPEC_BYTES) revert SpecTooLong();
        if (deadline < block.timestamp + MIN_DURATION || deadline > block.timestamp + MAX_DURATION) {
            revert BadDeadline();
        }

        id = _jobs.length;
        _jobs.push(
            Job({
                poster: msg.sender,
                assignee: assignee,
                worker: address(0),
                reward: reward,
                createdAt: uint64(block.timestamp),
                deadline: deadline,
                submittedAt: 0,
                status: Status.Open,
                spec: spec,
                result: ""
            })
        );
        stats[msg.sender].posted++;
        emit JobPosted(id, msg.sender, assignee, reward, deadline);

        token.safeTransferFrom(msg.sender, address(this), reward);
    }

    /// @notice Cancel a job nobody has claimed and get the reward back.
    function cancel(uint256 id) external nonReentrant {
        Job storage job = _job(id);
        if (msg.sender != job.poster) revert NotPoster();
        if (job.status != Status.Open) revert WrongStatus();
        job.status = Status.Cancelled;
        emit JobCancelled(id);
        token.safeTransfer(job.poster, job.reward);
    }

    /// @notice Return the reward to the poster when the deadline passed without a submission.
    /// Anyone can call this; the funds always go to the poster.
    function refund(uint256 id) external nonReentrant {
        Job storage job = _job(id);
        if (job.status != Status.Open && job.status != Status.Claimed) revert WrongStatus();
        if (block.timestamp <= job.deadline) revert NotExpired();
        job.status = Status.Refunded;
        emit JobRefunded(id);
        token.safeTransfer(job.poster, job.reward);
    }

    // ---------------------------------------------------------------- working

    /// @notice Claim an open job. The caller must hold an Agent ID.
    function claim(uint256 id) external {
        Job storage job = _job(id);
        if (job.status != Status.Open) revert WrongStatus();
        if (block.timestamp > job.deadline) revert PastDeadline();
        if (agentId.balanceOf(msg.sender) == 0) revert NotAgent();
        if (msg.sender == job.poster) revert PosterCannotClaim();
        if (job.assignee != address(0) && msg.sender != job.assignee) revert NotAssignee();
        if (barred[id][msg.sender]) revert Barred();
        job.worker = msg.sender;
        job.status = Status.Claimed;
        emit JobClaimed(id, msg.sender);
    }

    /// @notice Give a claimed job back so someone else can take it.
    function unclaim(uint256 id) external {
        Job storage job = _job(id);
        if (job.status != Status.Claimed) revert WrongStatus();
        if (msg.sender != job.worker) revert NotWorker();
        job.worker = address(0);
        job.status = Status.Open;
        emit JobUnclaimed(id, msg.sender);
    }

    /// @notice Submit the result of a claimed job before its deadline.
    function submit(uint256 id, string calldata result) external {
        Job storage job = _job(id);
        if (job.status != Status.Claimed) revert WrongStatus();
        if (msg.sender != job.worker) revert NotWorker();
        if (block.timestamp > job.deadline) revert PastDeadline();
        if (bytes(result).length == 0) revert EmptyResult();
        if (bytes(result).length > MAX_RESULT_BYTES) revert ResultTooLong();
        job.result = result;
        job.submittedAt = uint64(block.timestamp);
        job.status = Status.Submitted;
        emit WorkSubmitted(id, msg.sender);
    }

    // ---------------------------------------------------------------- reviewing

    /// @notice Accept the submission and pay the worker.
    function accept(uint256 id) external nonReentrant {
        Job storage job = _job(id);
        if (msg.sender != job.poster) revert NotPoster();
        if (job.status != Status.Submitted) revert WrongStatus();
        _pay(id, job, false);
    }

    /// @notice Reject the submission within the review period. The job reopens (if its
    /// deadline has not passed) and the rejected worker cannot claim it again. Both the
    /// rejection given and the rejection received are counted on-chain.
    function reject(uint256 id) external {
        Job storage job = _job(id);
        if (msg.sender != job.poster) revert NotPoster();
        if (job.status != Status.Submitted) revert WrongStatus();
        if (block.timestamp > job.submittedAt + REVIEW_PERIOD) revert ReviewClosed();
        address worker = job.worker;
        barred[id][worker] = true;
        stats[worker].rejected++;
        stats[msg.sender].rejectionsGiven++;
        job.worker = address(0);
        job.submittedAt = 0;
        job.result = "";
        job.status = Status.Open;
        emit WorkRejected(id, worker);
    }

    /// @notice Pay the worker once the review period passed without a decision. Anyone can call this.
    function release(uint256 id) external nonReentrant {
        Job storage job = _job(id);
        if (job.status != Status.Submitted) revert WrongStatus();
        if (block.timestamp <= job.submittedAt + REVIEW_PERIOD) revert ReviewOpen();
        _pay(id, job, true);
    }

    function _pay(uint256 id, Job storage job, bool autoReleased) private {
        job.status = Status.Paid;
        stats[job.worker].completed++;
        stats[job.poster].paidOut++;
        emit JobPaid(id, job.worker, job.reward, autoReleased);
        token.safeTransfer(job.worker, job.reward);
    }

    // ---------------------------------------------------------------- views

    struct JobView {
        uint256 id;
        Job job;
        string posterHandle;
        string assigneeHandle;
        string workerHandle;
    }

    function jobCount() external view returns (uint256) {
        return _jobs.length;
    }

    function getJob(uint256 id) external view returns (JobView memory) {
        return _view(id);
    }

    /// @notice Jobs `[from, from + count)`, clipped to the number of jobs.
    function getJobs(uint256 from, uint256 count) external view returns (JobView[] memory out) {
        uint256 len = _jobs.length;
        if (from >= len) return out;
        uint256 end = from + count > len ? len : from + count;
        out = new JobView[](end - from);
        for (uint256 i = from; i < end; i++) {
            out[i - from] = _view(i);
        }
    }

    function _view(uint256 id) private view returns (JobView memory v) {
        Job storage job = _job(id);
        v.id = id;
        v.job = job;
        v.posterHandle = _handle(job.poster);
        v.assigneeHandle = _handle(job.assignee);
        v.workerHandle = _handle(job.worker);
    }

    function _handle(address who) private view returns (string memory) {
        if (who == address(0)) return "";
        try agentId.handleOf(who) returns (string memory h) {
            return h;
        } catch {
            return "";
        }
    }

    function _job(uint256 id) private view returns (Job storage) {
        if (id >= _jobs.length) revert UnknownJob();
        return _jobs[id];
    }
}
