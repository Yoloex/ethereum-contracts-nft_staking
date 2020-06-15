const { accounts, contract } = require('@openzeppelin/test-environment');
const { NFCollectionMaskLength } = require('../../../src').constants;

const { shouldSupportInterfaces } = require('@animoca/ethereum-contracts-core_library');
const { interfaces } = require('@animoca/ethereum-contracts-assets_inventory');

const {RewardsTokenInitialBalance,
    DayInSeconds, CycleLengthInSeconds, PeriodLengthInSeconds, PeriodLengthInCycles,
    RarityWeights, TokenIds, DefaultRewardSchedule, RewardsPool} = require('./constants');

const { deploymentPreconditionsScenario, simpleScenario, lateClaimScenario,
    periodLimitsScenario, multiStakersScenario } = require('./scenarios');

const AssetsInventory = contract.fromArtifact("AssetsInventoryMock");
const ERC20WithOperators = contract.fromArtifact("ERC20WithOperatorsMock");
const NftStaking = contract.fromArtifact("NftStakingTestableMock");

describe.only('NftStaking', function () {
    const [
        creator,
        staker,
        otherStaker,
        ...otherAccounts
    ] = accounts;

    async function doFreshDeploy() {
        this.nftContract = await AssetsInventory.new(NFCollectionMaskLength, { from: creator });

        this.rewardsToken = await ERC20WithOperators.new(RewardsTokenInitialBalance, { from: creator });

        this.stakingContract = await NftStaking.new(
            CycleLengthInSeconds,
            PeriodLengthInCycles,
            this.nftContract.address,
            this.rewardsToken.address,
            RarityWeights.map(x => x.rarity),
            RarityWeights.map(x => x.weight),
            { from: creator }
        );
        this.contract = this.stakingContract;

        await this.rewardsToken.approve(this.stakingContract.address, RewardsTokenInitialBalance, { from: creator });

        for (const tokenId of TokenIds) {
            await this.nftContract.mintNonFungible(staker, tokenId, { from: creator });
        }
    }

    async function start(rewardSchedule = DefaultRewardSchedule) {
        for (schedule of rewardSchedule) {
            await this.stakingContract.setRewardsForPeriods(
                schedule.startPeriod,
                schedule.endPeriod,
                schedule.rewardPerCycle,
                { from: creator }
            );
        }

        await this.stakingContract.start({ from: creator });
    }

    describe('Deployment pre-conditions', function () {
        before(doFreshDeploy);

        deploymentPreconditionsScenario.bind(this, staker)();
    });

    describe('Scenario: Simple', function () {
        before(doFreshDeploy);
        before(start);

        simpleScenario.bind(this, staker)();
    });

    describe('Scenario: Period Limits', function () {
        before(doFreshDeploy);
        before(start);

        periodLimitsScenario.bind(this, staker, otherStaker)();
    });

    describe('Scenario: Late Claim', function () {
        before(doFreshDeploy);
        before(start);

        lateClaimScenario.bind(this, staker)();
    });

    describe('Scenario: Multi Stakers', function () {
        before(doFreshDeploy);
        before(start);

        multiStakersScenario.bind(this, creator, staker, otherStaker)();
    });

    describe("interface support", function () {
        before(doFreshDeploy);
        shouldSupportInterfaces([
            interfaces.ERC1155TokenReceiver
        ]);
    });

});
