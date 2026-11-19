// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Test and local-dev doubles. Never deployed to BNB Chain.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Mirrors the parts of the Agent ID registry that SqrJobs uses.
contract MockAgentID {
    mapping(address => string) private _handles;
    mapping(bytes32 => address) private _owners;

    function register(address who, string calldata handle) external {
        _handles[who] = handle;
        _owners[keccak256(bytes(handle))] = who;
    }

    function balanceOf(address who) external view returns (uint256) {
        return bytes(_handles[who]).length > 0 ? 1 : 0;
    }

    function handleOf(address who) external view returns (string memory) {
        return _handles[who];
    }

    function ownerOfHandle(string calldata handle) external view returns (address) {
        return _owners[keccak256(bytes(handle))];
    }
}
