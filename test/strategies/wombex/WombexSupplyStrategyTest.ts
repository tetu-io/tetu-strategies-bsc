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

  }
}
describe('WombexStrategy supply tests', async () => {
  const underlyingInfos = [
     [BscAddresses.USDT_TOKEN, BscAddresses.LP_USDT, BscAddresses.wmxLP_USDT_VAULT],
     [BscAddresses.USDC_TOKEN, BscAddresses.LP_USDC, BscAddresses.wmxLP_USDC_VAULT],
     // [BscAddresses.DAI_TOKEN, BscAddresses.LP_DAI, BscAddresses.wmxLP_DAI_VAULT],
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
    const deposit = 100_000;
    // at least 3
    const loops = 3;
    const buyBackRatio = 500;
    // number of blocks or timestamp value
    const loopValue = 60 * 60; // 1 hour
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
