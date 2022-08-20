// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IConeStacker {

  function gaugeBalance(address gauge) external view returns (uint);

  function gaugeUser(address gauge) external view returns (address);

  function userBalance(address gauge, address user) external view returns (uint);

  function lock(uint amount, bool isClaim) external;

  function increaseUnlockTime() external;

  function depositToGauge(address pool, address gauge, uint amount) external;

  function withdrawFromGauge(address pool, address gauge, uint amount) external;

  function claim(address gauge, address[] memory gaugeTokens, address[] memory bribeTokens) external;

}
