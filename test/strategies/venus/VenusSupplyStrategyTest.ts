import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {config as dotEnvConfig} from "dotenv";
import {StrategyTestUtils} from "../StrategyTestUtils";
import {DeployInfo} from "../DeployInfo";
import {SpecificStrategyTest} from "../SpecificStrategyTest";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {CoreContractsWrapper} from "../../CoreContractsWrapper";
import {DeployerUtilsLocal} from "../../../scripts/deploy/DeployerUtilsLocal";
import {
  IStrategy,
  ISmartVault,
  StrategyVenusSupply__factory,
  ITetuLiquidator__factory,
  ITetuLiquidatorController__factory,
  ISwapper__factory, IUniswapV2Pair__factory,
} from "../../../typechain";
import {ToolsContractsWrapper} from "../../ToolsContractsWrapper";
import {universalStrategyTest} from "../UniversalStrategyTest";
import {DoHardWorkLoopBase} from "../DoHardWorkLoopBase";
import {BscAddresses} from "../../../scripts/addresses/BscAddresses";
import {BigNumber} from "ethers";
import {EmergencyWithdrawFromPoolTest} from "./EmergencyWithdrawFromPoolTest";

dotEnvConfig();
// tslint:disable-next-line:no-var-requires
const argv = require('yargs/yargs')()
  .env('TETU')
  .options({
    disableStrategyTests: {
      type: "boolean",
      default: false,
    },
    deployCoreContracts: {
      type: "boolean",
      default: false,
    },
    hardhatChainId: {
      type: "number",
      default: 56
    },
  }).argv;

const {expect} = chai;
chai.use(chaiAsPromised);

const configureLiquidator = async (signer: SignerWithAddress, deployInfo: DeployInfo) => {
  if (deployInfo.core) {
    const liquidatorAddress = BscAddresses.LIQUIDATOR_ADDRESS;
    const liquidator = ITetuLiquidator__factory.connect(liquidatorAddress, signer)
    const liquidatorController = ITetuLiquidatorController__factory.connect(await liquidator.controller(), signer)
    const gov = await DeployerUtilsLocal.impersonate(await liquidatorController.governance())
    await liquidatorController.connect(gov).changeOperatorStatus(signer.address, true);

    await liquidator.addLargestPools([{
      pool: BscAddresses.XVS_WBNB_PANCAKESWAP_POOL,
      swapper: BscAddresses.UNIV2_SWAPPER,
      tokenIn: BscAddresses.XVS_TOKEN,
      tokenOut: BscAddresses.WBNB_TOKEN,
    }], true)

    await liquidator.addLargestPools([{
      pool: BscAddresses.BTCB_WETH_PANCAKESWAP_POOL,
      swapper: BscAddresses.PANCAKEV3_SWAPPER,
      tokenIn: BscAddresses.BTCB,
      tokenOut: BscAddresses.WETH_TOKEN,
    }], true)

    await liquidator.addLargestPools([{
      pool: BscAddresses.DAI_USDT_BITSWAP_POOL,
      swapper: BscAddresses.UNIV2_SWAPPER,
      tokenIn: BscAddresses.DAI_TOKEN,
      tokenOut: BscAddresses.USDT_TOKEN,
    }], true)

    // // need to set fee
    const univ2Swapper = ISwapper__factory.connect(BscAddresses.UNIV2_SWAPPER, signer);
    const btcbWbnbPancakeswapPool = IUniswapV2Pair__factory.connect(BscAddresses.DAI_USDT_BITSWAP_POOL, signer);
    await univ2Swapper.connect(gov).setFee(await btcbWbnbPancakeswapPool.factory(), 250);

  }
}

describe('Venus supply tests', async () => {
  const infos = [
    [BscAddresses.vUSDT_TOKEN, BscAddresses.USDT_TOKEN],
    // [BscAddresses.vUSDC_TOKEN, BscAddresses.USDC_TOKEN],
    // [BscAddresses.vETH_TOKEN, BscAddresses.WETH_TOKEN],
    // [BscAddresses.vDAI_TOKEN, BscAddresses.DAI_TOKEN],
    // [BscAddresses.vBTC_TOKEN, BscAddresses.BTCB],
  ]

  if (argv.disableStrategyTests || argv.hardhatChainId !== 56) {
    return;
  }

  const strategyName = 'StrategyVenusSupply';

  const deployInfo: DeployInfo = new DeployInfo();
  before(async function () {
    await StrategyTestUtils.deployCoreAndInit(deployInfo, argv.deployCoreContracts);
    const signer = await DeployerUtilsLocal.impersonate();
    await configureLiquidator(signer, deployInfo);
  });
  infos.forEach(info => {
    // **********************************************
    // ************** CONFIG*************************
    // **********************************************
    const strategyContractName = strategyName;
    const vaultName = 'VenusStrategyTest_vault';
    const vTokenAddress = info[0];
    const underlying = info[1];
    // add custom liquidation path if necessary
    const forwarderConfigurator = null;

    // only for strategies where we expect PPFS fluctuations
    const ppfsDecreaseAllowed = false;
    // only for strategies where we expect PPFS fluctuations
    const balanceTolerance = 0;
    const finalBalanceTolerance = 0;
    const deposit = 100_000;
    // at least 3
    const loops = 3;
    const buyBackRatio = 500;
    // number of blocks or timestamp value
    const loopValue = 86400;
    // use 'true' if farmable platform values depends on blocks, instead you can use timestamp
    const advanceBlocks = true;
    const specificTests: SpecificStrategyTest[] = [
      new EmergencyWithdrawFromPoolTest(),
    ];
    // **********************************************

    const deployer = (signer: SignerWithAddress) => {
      const core = deployInfo.core as CoreContractsWrapper;
      return StrategyTestUtils.deploy(
        signer,
        core,
        vaultName,
        async vaultAddress => {
          const strategy = await DeployerUtilsLocal.deployStrategyProxy(
            signer,
            strategyContractName,
          );
          const strat = StrategyVenusSupply__factory.connect(strategy.address, signer);
          await strat.initialize(
            core.controller.address,
            underlying,
            vaultAddress,
            vTokenAddress,
            buyBackRatio
          );
          await core.controller.setRewardDistribution([strategy.address], true);
          return strategy;
        },
        underlying,
        0,
        false
      );
    };
    const hwInitiator = (
      _signer: SignerWithAddress,
      _user: SignerWithAddress,
      _core: CoreContractsWrapper,
      _tools: ToolsContractsWrapper,
      _underlying: string,
      _vault: ISmartVault,
      _strategy: IStrategy,
      _balanceTolerance: number
    ) => {
      const hw = new DoHardWorkLoopBase(
        _signer,
        _user,
        _core,
        _tools,
        _underlying,
        _vault,
        _strategy,
        _balanceTolerance,
        finalBalanceTolerance,
      );
      hw.vaultRt = BscAddresses.ZERO_ADDRESS
      // we may have some rewards in a form of XVS
      hw.allowLittleDustInStrategyAfterFullExit = BigNumber.from(230000000)
      return hw;
    };

    universalStrategyTest(
      strategyName + vaultName,
      deployInfo,
      deployer,
      hwInitiator,
      forwarderConfigurator,
      ppfsDecreaseAllowed,
      balanceTolerance,
      deposit,
      loops,
      loopValue,
      advanceBlocks,
      specificTests,
    );
  });
});
