// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IBribe {

  function notifyRewardAmount(address token, uint amount) external;

  function _deposit(uint amount, uint tokenId) external;

  function _withdraw(uint amount, uint tokenId) external;

  function getReward(uint tokenId, address[] memory tokens) external;

  function getRewardForOwner(uint tokenId, address[] memory tokens) external;

}
