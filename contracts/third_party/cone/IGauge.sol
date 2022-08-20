// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IGauge {

  function notifyRewardAmount(address token, uint amount) external;

  function getReward(address account, address[] memory tokens) external;

  function claimFees() external returns (uint claimed0, uint claimed1);

  function deposit(uint amount, uint tokenId) external;

  function withdraw(uint amount) external;

  function bribe() external view returns (address);
}
