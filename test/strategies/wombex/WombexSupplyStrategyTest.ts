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
  WombexSupplyStrategy__factory,
  ITetuLiquidator__factory,
  ITetuLiquidatorController__factory,
  ISwapper__factory,
  IUniswapV2Pair__factory,
  IBaseRewardPool4626__factory,
  IERC20__factory,
} from "../../../typechain";
import {ToolsContractsWrapper} from "../../ToolsContractsWrapper";
import {universalStrategyTest} from "../UniversalStrategyTest";
import {DoHardWorkLoopBase} from "../DoHardWorkLoopBase";
import {BscAddresses} from "../../../scripts/addresses/BscAddresses";
import {utils} from "ethers";
import {EmergencyWithdrawFromPoolTest} from "./EmergencyWithdrawFromPoolTest";
import {TokenUtils} from "../../TokenUtils";

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
      pool: BscAddresses.WOM_BUSD_PANCAKESWAP_POOL,
      swapper: BscAddresses.UNIV2_SWAPPER,
      tokenIn: BscAddresses.WOM_TOKEN,
      tokenOut: BscAddresses.BUSD_TOKEN,
    }], true)

    await liquidator.addLargestPools([{
      pool: BscAddresses.WMX_BUSD_PANCAKESWAP_POOL,
      swapper: BscAddresses.UNIV2_SWAPPER,
      tokenIn: BscAddresses.WMX_TOKEN,
      tokenOut: BscAddresses.BUSD_TOKEN,
    }], true)

    await liquidator.addLargestPools([{
      pool: BscAddresses.DAI_USDT_BITSWAP_POOL,
      swapper: BscAddresses.UNIV2_SWAPPER,
      tokenIn: BscAddresses.DAI_TOKEN,
      tokenOut: BscAddresses.USDT_TOKEN,
    }], true)

    // need to set fee
    const univ2Swapper = ISwapper__factory.connect(BscAddresses.UNIV2_SWAPPER, signer);
    const btcbWbnbPancakeswapPool = IUniswapV2Pair__factory.connect(BscAddresses.DAI_USDT_BITSWAP_POOL, signer);
    await univ2Swapper.connect(gov).setFee(await btcbWbnbPancakeswapPool.factory(), 250);
  }
}

const UNDERLYING_TO_LP = new Map<string, string>([
    [BscAddresses.USDT_TOKEN, BscAddresses.wmxLP_USDT_VAULT],
    [BscAddresses.USDC_TOKEN, BscAddresses.wmxLP_USDC_VAULT],
    [BscAddresses.DAI_TOKEN, BscAddresses.wmxLP_DAI_VAULT],
]);


const addRewards = async (signer: SignerWithAddress, underlying: string) => {
    const lpVaultAddress = UNDERLYING_TO_LP.get(underlying);
    if(lpVaultAddress) {
      const lpVault = IBaseRewardPool4626__factory.connect(lpVaultAddress, signer);
      const operator = await DeployerUtilsLocal.impersonate(await lpVault.operator())
      await TokenUtils.getToken(BscAddresses.WMX_TOKEN, operator.address, utils.parseUnits("100000", 18))
      await IERC20__factory.connect(BscAddresses.WMX_TOKEN, operator).approve(lpVault.address, utils.parseUnits("100000", 18))
      await lpVault.connect(operator).queueNewRewards(BscAddresses.WMX_TOKEN, utils.parseUnits("100000", 18));
    }
}

describe('WombexStrategy supply tests', async () => {
  const underlyingInfos = [
     [BscAddresses.USDT_TOKEN, BscAddresses.LP_USDT, BscAddresses.wmxLP_USDT_VAULT],
     [BscAddresses.USDC_TOKEN, BscAddresses.LP_USDC, BscAddresses.wmxLP_USDC_VAULT],
     [BscAddresses.DAI_TOKEN, BscAddresses.LP_DAI, BscAddresses.wmxLP_DAI_VAULT],
  ]

  if (argv.disableStrategyTests || argv.hardhatChainId !== 56) {
    return;
  }

  const strategyContractName = 'WombexSupplyStrategy';

  const deployInfo: DeployInfo = new DeployInfo();
  before(async function () {
    await StrategyTestUtils.deployCoreAndInit(deployInfo, argv.deployCoreContracts);
    const signer = await DeployerUtilsLocal.impersonate();
    await configureLiquidator(signer, deployInfo);
  });
  underlyingInfos.forEach(info => {
    // **********************************************
    // ************** CONFIG*************************
    // **********************************************
    const vaultName = 'WombexStrategyBase_vault';

    // add custom liquidation path if necessary
    const forwarderConfigurator = null;

    const underlying = info[0];
    const lpToken = info[1];
    const wmxLPVault = info[2];

    // only for strategies where we expect PPFS fluctuations
    const ppfsDecreaseAllowed = false;
    // only for strategies where we expect PPFS fluctuations
    const balanceTolerance = 0
    const finalBalanceTolerance = 0;
    let deposit = 100_000;
    if(underlying === BscAddresses.DAI_TOKEN) {
      deposit = 10_000;
    }
    // at least 3
    const loops = 3;
    const buyBackRatio = 500;
    // number of blocks or timestamp value
    const loopValue = 60 * 60 * 24; // 1 day
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
          const strat = WombexSupplyStrategy__factory.connect(strategy.address, signer);
          await strat.initialize(
            core.controller.address,
            underlying,
            lpToken,
            wmxLPVault,
            vaultAddress,
            buyBackRatio
          );
          await addRewards(signer, underlying);
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
      return hw;
    };

    universalStrategyTest(
      strategyContractName + vaultName,
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
