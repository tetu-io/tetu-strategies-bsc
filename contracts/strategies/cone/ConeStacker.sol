// SPDX-License-Identifier: ISC
/**
* By using this software, you understand, acknowledge and accept that Tetu
* and/or the underlying software are provided “as is” and “as available”
* basis and without warranties or representations of any kind either expressed
* or implied. Any use of this open source software released under the ISC
* Internet Systems Consortium license is done at your own risk to the fullest
* extent permissible pursuant to applicable law any and all liability as well
* as all warranties, including any fitness for a particular purpose with respect
* to Tetu and/or the underlying software and the use thereof are disclaimed.
*/
pragma solidity 0.8.4;

import "@tetu_io/tetu-contracts/contracts/base/governance/ControllableV2.sol";
import "@tetu_io/tetu-contracts/contracts/openzeppelin/SafeERC20.sol";
import "@tetu_io/tetu-contracts/contracts/openzeppelin/ReentrancyGuard.sol";
import "../../third_party/cone/IRouter.sol";
import "../../third_party/cone/IGauge.sol";
import "../../third_party/cone/IBribe.sol";
import "../../third_party/cone/IVe.sol";
import "../../third_party/cone/IVoter.sol";
import "../../third_party/cone/IVeDist.sol";
import "./IConeStacker.sol";

contract ConeStacker is ControllableV2, ReentrancyGuard, IConeStacker {
  using SafeERC20 for IERC20;

  // ************************************************
  //                CONSTANTS
  // ************************************************

  /// @dev Version of the contract
  string public constant VERSION = "1.0.4";
  string public constant NAME = "ConeStacker";
  address public constant CONE = 0xA60205802E1B5C6EC1CAFA3cAcd49dFeECe05AC9;
  IVe public constant VE = IVe(0xd0C1378c177E961D96c06b0E8F6E7841476C81Ef);
  IVoter public constant VOTER = IVoter(0xC3B5d80E4c094B17603Ea8Bb15d2D31ff5954aAE);
  IVeDist public constant VE_DIST = IVeDist(0xdfB765935D7f4e38641457c431F89d20Db571674);
  uint public constant MAX_LOCK = 4 * 365 * 86400;

  // ************************************************
  //                VARIABLES
  // ************************************************

  /// @dev General veNFT
  uint public veId;
  /// @dev Allowed depositors
  mapping(address => bool) public depositors;
  /// @dev Gauge => balance for the current user
  mapping(address => uint) public override gaugeBalance;
  /// @dev Gauge => current user
  mapping(address => address) public override gaugeUser;

  // ************************************************
  //                  INIT
  // ************************************************

  /// @dev Initialize contract after setup it as proxy implementation
  function initialize(address _controller) external initializer {
    initializeControllable(_controller);
  }

  // ************************************************
  //                  RESTRICTIONS
  // ************************************************

  modifier onlyGov() {
    require(msg.sender == IController(_controller()).governance(), "Not gov");
    _;
  }

  modifier onlyDepositor() {
    require(depositors[msg.sender], "Not depositor");
    _;
  }

  // ************************************************
  //                  VIEWS
  // ************************************************

  function userBalance(address gauge, address user) external view override returns (uint) {
    if (gaugeUser[gauge] == user) {
      return gaugeBalance[gauge];
    }
    return 0;
  }

  // ************************************************
  //                GOV ACTIONS
  // ************************************************

  function changeDepositorStatus(address depositor, bool status) external onlyGov {
    depositors[depositor] = status;
  }

  function vote(address[] calldata _poolVote, int256[] calldata _weights) external onlyGov {
    VOTER.vote(veId, _poolVote, _weights);
  }

  // ************************************************
  //                USER ACTIONS
  // ************************************************

  function merge(uint fromId) external {
    VE.merge(fromId, veId);
  }

  function lock(uint amount, bool isClaim) external override {
    uint _veId = veId;
    _approveIfNeeds(CONE, amount, address(VE));
    if (_veId == 0) {
      veId = VE.createLock(amount, MAX_LOCK);
    } else {
      if (amount != 0) {
        VE.increaseAmount(_veId, amount);
      }
      if (isClaim) {
        if (VE.lockedEnd(_veId) - MAX_LOCK + 1 weeks < (block.timestamp / 1 weeks * 1 weeks)) {
          VE.increaseUnlockTime(_veId, MAX_LOCK);
        }
        VE_DIST.claim(_veId);
      }
    }
  }

  function increaseUnlockTime() external override {
    uint _veId = veId;
    if (_veId != 0) {
      VE.increaseUnlockTime(_veId, MAX_LOCK);
    }
  }

  function depositToGauge(address pool, address gauge, uint amount) external onlyDepositor nonReentrant override {
    address _gaugeUser = gaugeUser[gauge];
    require(_gaugeUser == address(0) || _gaugeUser == msg.sender, "Only 1 user allowed");
    if (_gaugeUser == address(0)) {
      gaugeUser[gauge] = msg.sender;
      // refresh balance for the new user, need to fix a bug from v1.0.3
      gaugeBalance[gauge] = 0;
    }

    _approveIfNeeds(pool, amount, gauge);
    IGauge(gauge).deposit(amount, veId);
    gaugeBalance[gauge] += amount;
  }

  function withdrawFromGauge(address pool, address gauge, uint amount) external nonReentrant override {
    require(gaugeUser[gauge] == msg.sender, "Not user");

    uint balance = gaugeBalance[gauge];
    require(balance >= amount, "Not enough balance");
    IGauge(gauge).withdraw(amount);
    if (balance == amount) {
      delete gaugeUser[gauge];
      delete gaugeBalance[gauge];
    } else {
      gaugeBalance[gauge] = balance - amount;
    }
    IERC20(pool).safeTransfer(msg.sender, amount);
  }

  function claim(address gauge, address[] memory gaugeTokens, address[] memory bribeTokens) external nonReentrant override {
    require(gaugeUser[gauge] == msg.sender, "Not user");

    IGauge(gauge).getReward(address(this), gaugeTokens);

    if (veId != 0) {
      IBribe(IGauge(gauge).bribe()).getReward(veId, bribeTokens);
    }

    for (uint i; i < gaugeTokens.length; i++) {
      uint balance = IERC20(gaugeTokens[i]).balanceOf(address(this));
      if (balance != 0) {
        IERC20(gaugeTokens[i]).safeTransfer(msg.sender, balance);
      }
    }
    if (veId != 0) {
      for (uint i; i < bribeTokens.length; i++) {
        uint balance = IERC20(bribeTokens[i]).balanceOf(address(this));
        if (balance != 0) {
          IERC20(bribeTokens[i]).safeTransfer(msg.sender, balance);
        }
      }
    }
  }

  // ************************************************
  //                INTERNAL
  // ************************************************

  function _approveIfNeeds(address token, uint amount, address spender) internal {
    if (IERC20(token).allowance(address(this), spender) < amount) {
      IERC20(token).safeApprove(spender, 0);
      IERC20(token).safeApprove(spender, type(uint).max);
    }
  }

}
