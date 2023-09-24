// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IBaseRewardPool4626 {
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
    event Deposit(
        address indexed caller,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );
    event Donate(address indexed token, uint256 amount);
    event RewardAdded(
        address indexed token,
        uint256 currentRewards,
        uint256 newRewards
    );
    event RewardPaid(
        address indexed token,
        address indexed user,
        uint256 reward
    );
    event SetRewardTokenPaused(
        address indexed sender,
        address indexed token,
        bool indexed paused
    );
    event Staked(address indexed user, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event UpdateOperatorData(
        address indexed sender,
        address indexed operator,
        uint256 indexed pid
    );
    event Withdraw(
        address indexed caller,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );
    event Withdrawn(address indexed user, uint256 amount);

    function DURATION() external view returns (uint256);

    function MAX_TOKENS() external view returns (uint256);

    function NEW_REWARD_RATIO() external view returns (uint256);

    function allRewardTokens(uint256) external view returns (address);

    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function asset() external view returns (address);

    function balanceOf(address account) external view returns (uint256);

    function boosterRewardToken() external view returns (address);

    function claimableRewards(address _account)
        external
        view
        returns (address[] memory tokens, uint256[] memory amounts);

    function convertToAssets(uint256 shares) external view returns (uint256);

    function convertToShares(uint256 assets) external view returns (uint256);

    function decimals() external view returns (uint8);

    function deposit(uint256 assets, address receiver)
        external
        returns (uint256);

    function donate(address _token, uint256 _amount) external returns (bool);

    function earned(address _token, address _account)
        external
        view
        returns (uint256);

    function getReward() external returns (bool);

    function getReward(address _account, bool _lockCvx) external returns (bool);

    function lastTimeRewardApplicable(address _token)
        external
        view
        returns (uint256);

    function maxDeposit(address) external view returns (uint256);

    function maxMint(address owner) external view returns (uint256);

    function maxRedeem(address owner) external view returns (uint256);

    function maxWithdraw(address owner) external view returns (uint256);

    function mint(uint256 shares, address receiver) external returns (uint256);

    function name() external view returns (string memory);

    function operator() external view returns (address);

    function pid() external view returns (uint256);

    function previewDeposit(uint256 assets) external view returns (uint256);

    function previewMint(uint256 shares) external view returns (uint256);

    function previewRedeem(uint256 shares) external view returns (uint256);

    function previewWithdraw(uint256 assets)
        external
        view
        returns (uint256 shares);

    function processIdleRewards() external;

    function queueNewRewards(address _token, uint256 _rewards)
        external
        returns (bool);

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external returns (uint256);

    function rewardPerToken(address _token) external view returns (uint256);

    function rewardTokensLen() external view returns (uint256);

    function rewardTokensList() external view returns (address[] memory);

    function rewards(address, address) external view returns (uint256);

    function setRewardTokenPaused(address token_, bool paused_) external;

    function stake(uint256 _amount) external returns (bool);

    function stakeAll() external returns (bool);

    function stakeFor(address _for, uint256 _amount) external returns (bool);

    function stakingToken() external view returns (address);

    function symbol() external view returns (string memory);

    function tokenRewards(address)
        external
        view
        returns (
            address token,
            uint256 periodFinish,
            uint256 rewardRate,
            uint256 lastUpdateTime,
            uint256 rewardPerTokenStored,
            uint256 queuedRewards,
            uint256 currentRewards,
            uint256 historicalRewards,
            bool paused
        );

    function totalAssets() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function transfer(address, uint256) external returns (bool);

    function transferFrom(
        address,
        address,
        uint256
    ) external returns (bool);

    function updateOperatorData(address operator_, uint256 pid_) external;

    function userRewardPerTokenPaid(address, address)
        external
        view
        returns (uint256);

    function withdraw(uint256 amount, bool claim) external returns (bool);

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external returns (uint256);

    function withdrawAll(bool claim) external;

    function withdrawAllAndUnwrap(bool claim) external;

    function withdrawAndUnwrap(uint256 amount, bool claim)
        external
        returns (bool);
}