// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface WmxClaimZap {
    function claimRewards(
        address[] memory rewardContracts,
        address[] memory extraRewardTokens,
        address[] memory tokenRewardContracts,
        uint256[] memory tokenRewardPids,
        uint256 depositWomMaxAmount,
        uint256 wmxWomMinOutAmount,
        uint256 depositWmxMaxAmount,
        uint256 options
    ) external;

    function extraRewardsDistributor() external view returns (address);

    function getName() external pure returns (string memory);

    function locker() external view returns (address);

    function owner() external view returns (address);

    function setApprovals() external;

    function wmx() external view returns (address);

    function wmxWomRewards() external view returns (address);

    function wom() external view returns (address);

    function womDepositor() external view returns (address);

    function womSwapDepositor() external view returns (address);

    function womWmx() external view returns (address);
}

