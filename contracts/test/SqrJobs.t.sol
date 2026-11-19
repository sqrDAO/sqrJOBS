// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SqrJobs, IAgentID} from "../contracts/SqrJobs.sol";
import {MockUSDC, MockAgentID} from "../contracts/mocks/Mocks.sol";


contract SqrJobsTest is Test {
    MockUSDC usdc;
    MockAgentID ids;
    SqrJobs jobs;

    address poster = makeAddr("poster");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address human = makeAddr("human"); // no Agent ID

    uint256 constant REWARD = 25e18;

    function setUp() public {
        usdc = new MockUSDC();
        ids = new MockAgentID();
        jobs = new SqrJobs(IERC20(address(usdc)), IAgentID(address(ids)));
        ids.register(poster, "poster");
        ids.register(alice, "alice");
        ids.register(bob, "bob");
        usdc.mint(poster, 1000e18);
        usdc.mint(human, 1000e18);
        vm.prank(poster);
        usdc.approve(address(jobs), type(uint256).max);
        vm.prank(human);
        usdc.approve(address(jobs), type(uint256).max);
    }

    function _post() internal returns (uint256) {
        vm.prank(poster);
        return jobs.postJob("Translate the README to Vietnamese", REWARD, uint64(block.timestamp + 1 days));
    }

    function _status(uint256 id) internal view returns (SqrJobs.Status) {
        return jobs.getJob(id).job.status;
    }

    function test_postLocksReward() public {
        uint256 id = _post();
        assertEq(id, 0);
        assertEq(jobs.jobCount(), 1);
        assertEq(usdc.balanceOf(address(jobs)), REWARD);
        assertEq(uint8(_status(id)), uint8(SqrJobs.Status.Open));
        SqrJobs.JobView memory v = jobs.getJob(id);
        assertEq(v.posterHandle, "poster");
        assertEq(v.job.spec, "Translate the README to Vietnamese");
    }

    function test_humanWithoutAgentIdCanPost() public {
        vm.prank(human);
        uint256 id = jobs.postJob("spec", REWARD, uint64(block.timestamp + 1 days));
        assertEq(jobs.getJob(id).posterHandle, "");
    }

    function test_postValidation() public {
        vm.startPrank(poster);
        vm.expectRevert(SqrJobs.NoReward.selector);
        jobs.postJob("spec", 0, uint64(block.timestamp + 1 days));
        vm.expectRevert(SqrJobs.EmptySpec.selector);
        jobs.postJob("", REWARD, uint64(block.timestamp + 1 days));
        vm.expectRevert(SqrJobs.BadDeadline.selector);
        jobs.postJob("spec", REWARD, uint64(block.timestamp + 10 minutes));
        vm.expectRevert(SqrJobs.BadDeadline.selector);
        jobs.postJob("spec", REWARD, uint64(block.timestamp + 91 days));
        vm.expectRevert(SqrJobs.SpecTooLong.selector);
        jobs.postJob(string(new bytes(2001)), REWARD, uint64(block.timestamp + 1 days));
        vm.expectRevert(SqrJobs.UnknownHandle.selector);
        jobs.postJobFor("spec", REWARD, uint64(block.timestamp + 1 days), "nobody");
        vm.stopPrank();
    }

    function test_happyPathAccept() public {
        uint256 id = _post();
        vm.prank(alice);
        jobs.claim(id);
        vm.prank(alice);
        jobs.submit(id, "ipfs://result");
        vm.prank(poster);
        jobs.accept(id);
        assertEq(usdc.balanceOf(alice), REWARD);
        assertEq(usdc.balanceOf(address(jobs)), 0);
        assertEq(uint8(_status(id)), uint8(SqrJobs.Status.Paid));
        (, uint32 paidOut,,,) = jobs.stats(poster);
        (,,, uint32 completed,) = jobs.stats(alice);
        assertEq(paidOut, 1);
        assertEq(completed, 1);
        assertEq(jobs.getJob(id).workerHandle, "alice");
    }

    function test_claimRequiresAgentId() public {
        uint256 id = _post();
        vm.prank(human);
        vm.expectRevert(SqrJobs.NotAgent.selector);
        jobs.claim(id);
    }

    function test_posterCannotClaimOwnJob() public {
        uint256 id = _post();
        vm.prank(poster);
        vm.expectRevert(SqrJobs.PosterCannotClaim.selector);
        jobs.claim(id);
    }

    function test_cannotClaimTwice() public {
        uint256 id = _post();
        vm.prank(alice);
        jobs.claim(id);
        vm.prank(bob);
        vm.expectRevert(SqrJobs.WrongStatus.selector);
        jobs.claim(id);
    }

    function test_postJobForOnlyAssigneeCanClaim() public {
        vm.prank(poster);
        uint256 id = jobs.postJobFor("spec", REWARD, uint64(block.timestamp + 1 days), "bob");
        assertEq(jobs.getJob(id).assigneeHandle, "bob");
        vm.prank(alice);
        vm.expectRevert(SqrJobs.NotAssignee.selector);
        jobs.claim(id);
        vm.prank(bob);
        jobs.claim(id);
    }

    function test_unclaimReopens() public {
        uint256 id = _post();
        vm.prank(alice);
        jobs.claim(id);
        vm.prank(bob);
        vm.expectRevert(SqrJobs.NotWorker.selector);
        jobs.unclaim(id);
        vm.prank(alice);
        jobs.unclaim(id);
        vm.prank(bob);
        jobs.claim(id);
        assertEq(jobs.getJob(id).job.worker, bob);
    }

    function test_submitChecks() public {
        uint256 id = _post();
        vm.prank(alice);
        jobs.claim(id);
        vm.prank(bob);
        vm.expectRevert(SqrJobs.NotWorker.selector);
        jobs.submit(id, "x");
        vm.startPrank(alice);
        vm.expectRevert(SqrJobs.EmptyResult.selector);
        jobs.submit(id, "");
        vm.expectRevert(SqrJobs.ResultTooLong.selector);
        jobs.submit(id, string(new bytes(1001)));
        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(SqrJobs.PastDeadline.selector);
        jobs.submit(id, "late");
        vm.stopPrank();
    }

    function test_rejectReopensAndBarsWorker() public {
        uint256 id = _post();
        vm.prank(alice);
        jobs.claim(id);
        vm.prank(alice);
        jobs.submit(id, "junk");
        vm.prank(alice);
        vm.expectRevert(SqrJobs.NotPoster.selector);
        jobs.reject(id);
        vm.prank(poster);
        jobs.reject(id);
        assertEq(uint8(_status(id)), uint8(SqrJobs.Status.Open));
        assertEq(jobs.getJob(id).job.result, "");
        assertTrue(jobs.barred(id, alice));
        (,,,, uint32 rejected) = jobs.stats(alice);
        (,, uint32 given,,) = jobs.stats(poster);
        assertEq(rejected, 1);
        assertEq(given, 1);
        vm.prank(alice);
        vm.expectRevert(SqrJobs.Barred.selector);
        jobs.claim(id);
        vm.prank(bob);
        jobs.claim(id);
    }

    function test_rejectClosesAfterReviewPeriod() public {
        uint256 id = _post();
        vm.prank(alice);
        jobs.claim(id);
        vm.prank(alice);
        jobs.submit(id, "work");
        vm.warp(block.timestamp + 3 days + 1);
        vm.prank(poster);
        vm.expectRevert(SqrJobs.ReviewClosed.selector);
        jobs.reject(id);
    }

    function test_releaseAfterReviewPeriod() public {
        uint256 id = _post();
        vm.prank(alice);
        jobs.claim(id);
        vm.prank(alice);
        jobs.submit(id, "work");
        vm.expectRevert(SqrJobs.ReviewOpen.selector);
        jobs.release(id);
        vm.warp(block.timestamp + 3 days + 1);
        vm.prank(human); // anyone can trigger it
        jobs.release(id);
        assertEq(usdc.balanceOf(alice), REWARD);
        assertEq(uint8(_status(id)), uint8(SqrJobs.Status.Paid));
    }

    function test_cancelOnlyWhileOpen() public {
        uint256 id = _post();
        vm.prank(alice);
        vm.expectRevert(SqrJobs.NotPoster.selector);
        jobs.cancel(id);
        vm.prank(alice);
        jobs.claim(id);
        vm.prank(poster);
        vm.expectRevert(SqrJobs.WrongStatus.selector);
        jobs.cancel(id);
        vm.prank(alice);
        jobs.unclaim(id);
        uint256 before = usdc.balanceOf(poster);
        vm.prank(poster);
        jobs.cancel(id);
        assertEq(usdc.balanceOf(poster), before + REWARD);
    }

    function test_refundAfterDeadline() public {
        uint256 id = _post();
        vm.prank(alice);
        jobs.claim(id);
        vm.expectRevert(SqrJobs.NotExpired.selector);
        jobs.refund(id);
        vm.warp(block.timestamp + 1 days + 1);
        uint256 before = usdc.balanceOf(poster);
        vm.prank(bob); // anyone can trigger it; funds go to the poster
        jobs.refund(id);
        assertEq(usdc.balanceOf(poster), before + REWARD);
        assertEq(uint8(_status(id)), uint8(SqrJobs.Status.Refunded));
    }

    function test_noRefundOnceSubmitted() public {
        uint256 id = _post();
        vm.prank(alice);
        jobs.claim(id);
        vm.prank(alice);
        jobs.submit(id, "work");
        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(SqrJobs.WrongStatus.selector);
        jobs.refund(id);
    }

    function test_claimPastDeadline() public {
        uint256 id = _post();
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(alice);
        vm.expectRevert(SqrJobs.PastDeadline.selector);
        jobs.claim(id);
    }

    function test_unknownJob() public {
        vm.expectRevert(SqrJobs.UnknownJob.selector);
        jobs.getJob(0);
    }

    function test_getJobsPaginates() public {
        _post();
        _post();
        _post();
        assertEq(jobs.getJobs(0, 2).length, 2);
        assertEq(jobs.getJobs(1, 10).length, 2);
        assertEq(jobs.getJobs(5, 10).length, 0);
        assertEq(jobs.getJobs(2, 1)[0].id, 2);
    }

    /// Escrow always holds exactly the rewards of unsettled jobs.
    function testFuzz_escrowBalance(uint8 seed) public {
        uint256 a = _post();
        uint256 b = _post();
        uint256 c = _post();
        vm.prank(alice);
        jobs.claim(a);
        vm.prank(alice);
        jobs.submit(a, "r");
        if (seed % 2 == 0) {
            vm.prank(poster);
            jobs.accept(a);
        }
        if (seed % 3 == 0) {
            vm.prank(poster);
            jobs.cancel(b);
        }
        uint256 open;
        for (uint256 i = 0; i < 3; i++) {
            SqrJobs.Status s = _status(i);
            if (s == SqrJobs.Status.Open || s == SqrJobs.Status.Claimed || s == SqrJobs.Status.Submitted) open += REWARD;
        }
        assertEq(usdc.balanceOf(address(jobs)), open);
        c;
    }
}
