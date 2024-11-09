// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


/**
 * @title GSXTokenV2
 * @notice An ERC20 token with tiered sale, vesting, and referral mechanisms.
 */
contract GSXTokenV2 is ERC20, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    string private constant TOKEN_NAME = "GSXToken";
    string private constant TOKEN_SYMBOL = "GSX";
    uint256 private constant DECIMALS = 10**18;
    uint256 private constant MAX_SUPPLY = 80_000_000 * DECIMALS;

    uint256 private constant VALIDATORS_REWARDS_AMOUNT = 30_000_000 * DECIMALS;
    uint256 private constant COMMUNITY_RESERVE_AMOUNT = 14_000_000 * DECIMALS;
    uint256 private constant SEED_ROUND_AMOUNT = 10_000_000 * DECIMALS;
    uint256 private constant CEX_DEX_AMOUNT = 8_000_000 * DECIMALS;
    uint256 private constant OPERATIONAL_RESERVES_AMOUNT = 4_000_000 * DECIMALS;
    uint256 private constant TEAM_AMOUNT = 4_000_000 * DECIMALS;

    /** @notice Unix timestamp for the start of the token sale (e.g., 4 Nov 2024) */
    uint256 public immutable saleStartUnix;
    /** @notice Unix timestamp for the start of the vesting period (e.g., 6 Jan 2025) */
    uint256 public immutable vestingStartUnix;
    /** @notice Mapping of tier number to its end Unix timestamp */
    mapping(uint8 => uint256) public tierEndUnix;
    uint256 public immutable singleWalletPurchaseLimitInUsdAtoms;

    IERC20 private immutable usdcToken;
    IERC20 private immutable usdtToken;
    uint256 private immutable usdTokensDecimals;

    address public validatorsRewardsWallet;
    address public communityReserveWallet;
    address public seedRoundWallet;
    address public cexDexWallet;
    address public operationalReservesWallet;
    address public teamWallet;

    uint256 public immutable tokenPriceUsdCents;
    uint256 public immutable minimumPurchaseAmountUsdAtoms;
    mapping(uint8 => uint256) public tierCapsGsxAtoms;
    mapping(uint8 => uint256) public tierTokensSoldGsxAtoms;
    mapping(uint8 => uint256) public tierVestingPeriodMonths;
    mapping(uint8 => uint256) public tierBonusPercent;
    mapping(address => uint256) public usdAtomsSpentOnGsx;
    uint256 public totalTokensBoughtGsxAtoms;
    mapping(address => mapping(uint8 => uint256)) public vestedAmountsGsxAtoms; // tokenOwner => tier => tokenAmount
    mapping(address => mapping(uint8 => uint256)) public claimedAmounts; // tokenOwner => tier => tokenAmount

    // Referrals
    address private admin;
    uint8 public immutable referralUserDiscountPercent;
    mapping(address => bool) public whitelistedReferrers;
    mapping(address => bool) public whitelistedSupporters;
    mapping(address => address) public usersReferrers;
    mapping(address => uint256) public totalUsdAtomsSpentByReferrersSupporters;

    /**
     * @notice Emitted when tokens are purchased.
     * @param contributor Address of the contributor.
     * @param tier Tier number of the purchase.
     * @param amountGsx Amount of GSX tokens purchased (excluding bonus).
     * @param amountGsxBonus Amount of bonus GSX tokens awarded.
     * @param cost Total cost in USD atoms.
     */
    event TokensPurchased(address indexed contributor, uint8 tier, uint256 amountGsx, uint256 amountGsxBonus, uint256 cost);
    /**
     * @notice Emitted when a user claims their vested tokens.
     * @param user Address of the user claiming tokens.
     * @param amount Amount of GSX tokens claimed.
     */
    event TokensClaimed(address indexed user, uint256 amount);
    /**
     * @notice Emitted when a referrer claims their referral rewards.
     * @param user Address of the referrer.
     * @param amount Amount of GSX tokens claimed as referral rewards.
     */
    event ReferralTokensClaimed(address indexed user, uint256 amount);
    /**
     * @notice Emitted when a referrer is removed from the whitelist.
     * @param user The address of the referrer being removed.
     * @param reason The reason for the removal of the referrer.
     */
    event ReferrerRemoved(address indexed user, string reason);

    /**
     * @notice Initializes the GSXTokenV2 contract with initial parameters.
     * @param _usdcTokenAddress Address of the USDC token contract.
     * @param _usdtTokenAddress Address of the USDT token contract.
     * @param _validatorsRewardsWallet Address for validators' rewards.
     * @param _communityReserveWallet Address for community reserve.
     * @param _seedRoundWallet Address for seed round tokens.
     * @param _cexDexWallet Address for CEX/DEX liquidity.
     * @param _operationalReservesWallet Address for operational reserves.
     * @param _teamWallet Address for team tokens.
     * @param _saleStartUnix Unix timestamp for sale start.
     * @param _vestingStartUnix Unix timestamp for vesting start.
     */
    constructor(
        address _usdcTokenAddress,
        address _usdtTokenAddress,
        address _validatorsRewardsWallet,
        address _communityReserveWallet,
        address _seedRoundWallet,
        address _cexDexWallet,
        address _operationalReservesWallet,
        address _teamWallet,
        uint256 _saleStartUnix,
        uint256 _vestingStartUnix
    ) ERC20(TOKEN_NAME, TOKEN_SYMBOL) Ownable(msg.sender) {
        _mint(address(this), MAX_SUPPLY);
        _distributeInitialTokens(
            _validatorsRewardsWallet,
            _communityReserveWallet,
            _seedRoundWallet,
            _cexDexWallet,
            _operationalReservesWallet,
            _teamWallet
        );
        saleStartUnix = _saleStartUnix;
        vestingStartUnix = _vestingStartUnix;
        tierEndUnix[1] = saleStartUnix + 2 weeks;
        tierEndUnix[2] = saleStartUnix + 4 weeks;
        tierEndUnix[3] = saleStartUnix + 6 weeks;

        tokenPriceUsdCents = 85;

        tierVestingPeriodMonths[1] = 9;
        tierVestingPeriodMonths[2] = 6;
        tierVestingPeriodMonths[3] = 0; // No vesting period

        tierBonusPercent[1] = 85;
        tierBonusPercent[2] = 25;
        tierBonusPercent[3] = 0;

        tierCapsGsxAtoms[1] = 4_400_000 * DECIMALS; // 4.4 M
        tierCapsGsxAtoms[2] = 3_200_000 * DECIMALS; // 3.2 M
        tierCapsGsxAtoms[3] = 2_400_000 * DECIMALS; // 2.4 M


        usdTokensDecimals = 10 ** 6;
        usdcToken = IERC20(_usdcTokenAddress);
        usdtToken = IERC20(_usdtTokenAddress);
        singleWalletPurchaseLimitInUsdAtoms = 30_000 * usdTokensDecimals; // in USD atoms
        minimumPurchaseAmountUsdAtoms = 50 * usdTokensDecimals;

        referralUserDiscountPercent = 5;
        totalTokensBoughtGsxAtoms = 0;

    }

    modifier onlyAdminOrOwner() {
        require(msg.sender == admin || msg.sender == owner(), "Caller is not the referral admin");
        _;
    }
    /**
     * @notice Distributes tokens to a recipient.
     * @dev Only callable by the owner.
     * @param recipient Address to receive the tokens.
     * @param amount Amount of tokens to distribute.
     */
    function distribute(address recipient, uint256 amount) external onlyOwner {
        require(balanceOf(address(this)) >= amount, "Insufficient tokens in contract");
        _transfer(address(this), recipient, amount);
    }

    function _distributeInitialTokens(
        address _validatorsRewardsWallet,
        address _communityReserveWallet,
        address _seedRoundWallet,
        address _cexDexWallet,
        address _operationalReservesWallet,
        address _teamWallet
    ) private {
        require(_validatorsRewardsWallet != address(0), "Initial Addresses cannot be zero.");
        require(_communityReserveWallet != address(0), "Initial Addresses cannot be zero.");
        require(_seedRoundWallet != address(0), "Initial Addresses cannot be zero.");
        require(_cexDexWallet != address(0), "Initial Addresses cannot be zero.");
        require(_operationalReservesWallet != address(0), "Initial Addresses cannot be zero.");
        require(_teamWallet != address(0), "Initial Addresses cannot be zero.");
        validatorsRewardsWallet = _validatorsRewardsWallet;
        communityReserveWallet = _communityReserveWallet;
        seedRoundWallet = _seedRoundWallet;
        cexDexWallet = _cexDexWallet;
        operationalReservesWallet = _operationalReservesWallet;
        teamWallet = _teamWallet;
        _transfer(address(this), validatorsRewardsWallet, VALIDATORS_REWARDS_AMOUNT);
        _transfer(address(this), communityReserveWallet, COMMUNITY_RESERVE_AMOUNT);
        _transfer(address(this), seedRoundWallet, SEED_ROUND_AMOUNT);
        _transfer(address(this), cexDexWallet, CEX_DEX_AMOUNT);
        _transfer(address(this), operationalReservesWallet, OPERATIONAL_RESERVES_AMOUNT);
        _transfer(address(this), teamWallet, TEAM_AMOUNT);
    }

    /**
     * @notice Allows users to claim their vested tokens.
     * @dev Tokens become claimable based on the vesting schedule.
     */
    function claimTokens() public nonReentrant whenNotPaused {
        require(block.timestamp >= vestingStartUnix, "Vesting has not started yet");
        uint256 claimableTier1 = getClaimableAmountForTier(msg.sender, 1);
        uint256 claimableTier2 = getClaimableAmountForTier(msg.sender, 2);
        uint256 claimableTier3 = getClaimableAmountForTier(msg.sender, 3);
        uint256 totalClaimable = claimableTier1 + claimableTier2 + claimableTier3;
        require(totalClaimable > 0, "No tokens available to claim at the moment");

        if (claimableTier1 > 0) {
            claimedAmounts[msg.sender][1] += claimableTier1;
        }
        if (claimableTier2 > 0) {
            claimedAmounts[msg.sender][2] += claimableTier2;
        }
        if (claimableTier3 > 0) {
            claimedAmounts[msg.sender][3] += claimableTier3;
        }

        _transfer(address(this), msg.sender, totalClaimable);
        emit TokensClaimed(msg.sender, totalClaimable);
    }

    /**
     * @dev Internal function to handle the purchase of GSX tokens using a USD-pegged ERC20 token.
     * @param amountToContributeGsxAtoms Amount of GSX atoms to contribute.
     * @param usdPaymentToken ERC20 token used for payment (e.g., USDC or USDT).
     */
    function contributeGsxAtomsForUsd(uint256 amountToContributeGsxAtoms, IERC20 usdPaymentToken) private {
        require(whitelistedSupporters[msg.sender], "You need to be whitelisted after KYC in oder to contribute tokens");
        require(block.timestamp > saleStartUnix, "Sale has not started yet");
        require(block.timestamp < getEndSaleUnix(), "Sale has ended");

        uint8 tier = getCurrentTier();
        require(tier != 0, "The token sale is closed");
        uint256 currentTierCapGsxAtoms = getTierCapGsxAtoms(tier);
        address usersReferrer = usersReferrers[msg.sender];

        uint256 bonusPercent = tierBonusPercent[tier];
        uint256 bonusTokens = (amountToContributeGsxAtoms * bonusPercent) / 100;
        uint256 totalTokensToVest = amountToContributeGsxAtoms + bonusTokens;
        require(getAvailableGsxAmount() >= totalTokensToVest, "Insufficient tokens in contract");

        require(totalTokensToVest + tierTokensSoldGsxAtoms[tier] <= currentTierCapGsxAtoms, "Amount exceeds available tokens in the current tier");

        uint256 totalCostInUsdAtoms = calculateCostForGsxInUsdAtoms(msg.sender, amountToContributeGsxAtoms);
        require(usdAtomsSpentOnGsx[msg.sender] + totalCostInUsdAtoms <= singleWalletPurchaseLimitInUsdAtoms, "Exceeded wallet purchase limit");
        require(usdAtomsSpentOnGsx[msg.sender] + totalCostInUsdAtoms >= minimumPurchaseAmountUsdAtoms, "Minimum purchase amount is not reached");

        usdPaymentToken.safeTransferFrom(msg.sender, address(this), totalCostInUsdAtoms);
        vestedAmountsGsxAtoms[msg.sender][tier] += totalTokensToVest;
        tierTokensSoldGsxAtoms[tier] += totalTokensToVest;
        usdAtomsSpentOnGsx[msg.sender] += totalCostInUsdAtoms;
        totalTokensBoughtGsxAtoms += totalTokensToVest;

        if (usersReferrer != address(0) && whitelistedReferrers[usersReferrer]) {
            totalUsdAtomsSpentByReferrersSupporters[usersReferrer] += totalCostInUsdAtoms;
        }

        emit TokensPurchased(msg.sender, tier, amountToContributeGsxAtoms, bonusTokens, totalCostInUsdAtoms);
    }

    /**
     * @notice Calculates the cost in USD atoms for a given amount of GSX atoms.
     * @param user Address of the contributor.
     * @param amountGsxAtomsToContribute Amount of GSX atoms to contribute.
     * @return totalCostInUsdAtoms Total cost in USD atoms after any discounts.
     */
    function calculateCostForGsxInUsdAtoms(address user, uint256 amountGsxAtomsToContribute) public view returns (uint256) {
        address usersReferrer = usersReferrers[user];

        uint256 totalCostInUsdAtoms = ((amountGsxAtomsToContribute * tokenPriceUsdCents * usdTokensDecimals) / DECIMALS ) / 100;

        if (usersReferrer != address(0)) {
            uint256 discount = (totalCostInUsdAtoms * referralUserDiscountPercent) / 100;
            totalCostInUsdAtoms -= discount;
        }
        require(totalCostInUsdAtoms > 0, "Amount to contribute is too low");
        return totalCostInUsdAtoms;
    }

    /**
     * @notice Calculates the claimable amount for a user in a specific tier.
     * @param _wallet Address of the user.
     * @param tier Tier number (1, 2, or 3).
     * @return Claimable amount of tokens in GSX atoms.
     */
    function getClaimableAmountForTier(address _wallet, uint8 tier) public view returns (uint256) {
        require(tier <= 3, "Invalid tier");

        uint256 totalVestedForCurrentTier = vestedAmountsGsxAtoms[_wallet][tier];
        uint256 alreadyClaimedForCurrentTier = claimedAmounts[_wallet][tier];

        if (totalVestedForCurrentTier == 0) {
            return 0;
        }

        // Division by 30 rounded up
        uint256 monthsSinceVestingStart = (block.timestamp - vestingStartUnix + 30 days) / 30 days;
        uint256 tierVestingFullLength = tierVestingPeriodMonths[tier];
        if (monthsSinceVestingStart >= tierVestingFullLength) {
            // allow to claim all remaining tokens
            return totalVestedForCurrentTier - alreadyClaimedForCurrentTier;
        }
        uint256 totalClaimableUntilNow = (totalVestedForCurrentTier / tierVestingFullLength) * monthsSinceVestingStart;
        if (totalClaimableUntilNow > alreadyClaimedForCurrentTier) {
            return totalClaimableUntilNow - alreadyClaimedForCurrentTier;
        }
        return 0;
    }

    /**
     * @notice Returns the amount of GSX tokens available for sale.
     * @return Amount of tokens available in GSX atoms.
     */
    function getAvailableGsxAmount() public view returns (uint256) {
//        return IERC20(address(this)).balanceOf(address(this)) - totalTokensBoughtGsxAtoms - tokensLockedForReferrals;
        return IERC20(address(this)).balanceOf(address(this)) - totalTokensBoughtGsxAtoms;
    }

    /**
     * @notice Allows a user to purchase GSX tokens using USDC.
     * @param amount Amount of USDC tokens to spend (in smallest units).
     */
    function contributeGsxAtomsForUsdc(uint256 amount) public whenNotPaused {
        contributeGsxAtomsForUsd(amount, usdcToken);
    }

    /**
     * @notice Allows a user to purchase GSX tokens using USDC, specifying the amount in whole tokens.
     * @param amount Amount of USDC tokens to spend (in whole tokens).
     */
    function contributeGsxForUsdc(uint256 amount) external whenNotPaused {
        contributeGsxAtomsForUsdc(amount * DECIMALS);
    }

    /**
     * @notice Allows a user to purchase GSX tokens using USDT.
     * @param amount Amount of USDT tokens to spend (in smallest units).
     */
    function contributeGsxAtomsForUsdt(uint256 amount) public whenNotPaused {
        contributeGsxAtomsForUsd(amount, usdtToken);
    }

    /**
     * @notice Allows a user to purchase GSX tokens using USDT, specifying the amount in whole tokens.
     * @param amount Amount of USDT tokens to spend (in whole tokens).
     */
    function contributeGsxForUsdt(uint256 amount) external whenNotPaused {
        contributeGsxAtomsForUsdt(amount * DECIMALS);
    }

    /**
     * @notice Retrieves the token cap for a specific tier.
     * @param tier Tier number.
     * @return Cap amount in GSX atoms.
     */
    function getTierCapGsxAtoms(uint8 tier) public view returns (uint256) {
        uint256 cap = tierCapsGsxAtoms[tier];
        require(cap > 0, "Invalid tier");
        return cap;
    }

    function getAvailableTierVolume(uint8 tier) public view returns (uint256) {
        return getTierCapGsxAtoms(tier) - tierTokensSoldGsxAtoms[tier];
    }

    function getCurrentTier() public view returns (uint8) {
        if (block.timestamp < saleStartUnix) {
            return 0;
        }
        if (block.timestamp < tierEndUnix[1]) {
            return 1;
        } else if (block.timestamp < tierEndUnix[2]) {
            return 2;
        } else if (block.timestamp < tierEndUnix[3]) {
            return 3;
        }
        return 0;
    }

    function getEndSaleUnix() internal view returns (uint256) {
        return tierEndUnix[3];
    }

    /**
     * @notice Whitelists a referrer.
     * @dev Only callable by admin or owner.
     * @param referrer Address of the referrer to whitelist.
     */
    function whitelistReferrer(address referrer) external onlyAdminOrOwner {
        whitelistedReferrers[referrer] = true;
    }

    /**
     * @notice Removes a referrer from the whitelist.
     * @dev Only callable by admin or owner.
     * @param referrer Address of the referrer to remove.
     */
    function removeReferrerFromWhitelist(address referrer, string memory reason) external onlyAdminOrOwner {
        whitelistedReferrers[referrer] = false;
        emit ReferrerRemoved(referrer, reason);
    }

    /**
     * @notice Assigns a referrer to a contributor.
     * @dev Only callable by admin or owner.
     * @param contributor Address of the contributor.
     * @param referrer Address of the referrer.
     */
    function addReferrer(address contributor, address referrer) external onlyAdminOrOwner {
        require(whitelistedReferrers[referrer], "This referrer is not in the referrer whitelist");
        usersReferrers[contributor] = referrer;
    }

    /**
     * @notice Whitelists a supporter (contributor) who has completed KYC.
     * @dev Only callable by admin or owner.
     * @param supporter Address of the supporter to whitelist.
     */
    function whitelistSupporter(address supporter) external onlyAdminOrOwner {
        whitelistedSupporters[supporter] = true;
    }

    /**
     * @notice Removes a supporter from the whitelist.
     * @dev Only callable by admin or owner.
     * @param supporter Address of the supporter to remove.
     */
    function removeSupporterFromWhitelist(address supporter) external onlyAdminOrOwner {
        whitelistedSupporters[supporter] = false;
    }

    function setReferralAdmin(address _referralAdmin) external onlyOwner {
        require(_referralAdmin != address(0), "Referral admin cannot be zero address");
        admin = _referralAdmin;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Allows the owner to withdraw any USD tokens (e.g., USDC or USDT) from the contract.
     * @param token Address of the ERC20 token contract (e.g., USDC or USDT).
     * @param amountAtoms Amount of tokens to withdraw in smallest units (atoms).
     * @param to Address to send the withdrawn tokens to.
     */
    function withdrawUsdTokens(IERC20 token, uint256 amountAtoms, address to) external onlyOwner {
        require(to != address(0), "Cannot withdraw to the zero address");
        require(amountAtoms > 0, "Withdrawal amount must be greater than zero");
        uint256 contractBalance = token.balanceOf(address(this));
        require(contractBalance >= amountAtoms, "Insufficient token balance in contract");

        token.safeTransfer(to, amountAtoms);
    }

}