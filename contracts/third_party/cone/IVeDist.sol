// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IVeDist {

  function checkpointToken() external;

  function checkpointTotalSupply() external;

  function claim(uint _tokenId) external returns (uint);

}
