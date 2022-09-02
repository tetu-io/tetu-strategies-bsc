import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {StrategyTestUtils} from "../../StrategyTestUtils";
import {DeployInfo} from "../../DeployInfo";
import {SpecificStrategyTest} from "../../SpecificStrategyTest";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {CoreContractsWrapper} from "../../../CoreContractsWrapper";
import {DeployerUtilsLocal} from "../../../../scripts/deploy/DeployerUtilsLocal";
import {ConeStacker__factory, ISmartVault, IStrategy, StrategyCone} from "../../../../typechain";
import {ToolsContractsWrapper} from "../../../ToolsContractsWrapper";
import {universalStrategyTest} from "../../UniversalStrategyTest";
import {DoHardWorkLoopBase} from "../../DoHardWorkLoopBase";
import {BscAddresses} from "../../../../scripts/addresses/BscAddresses";
import {ConeConstants} from "../../../../scripts/deploy/strategies/cone/ConeConstants";


const {expect} = chai;
chai.use(chaiAsPromised);

describe.skip('cone tetu usdplus strategy tests', async () => {
  const strategyName = 'StrategyCone';
  const underlying = "0x0f8c95890b7bdecfae7990bf32f22120111e0b44";
  const gauge = "0x965b78533a72d2a18fa31f3449887572e9a54a1e";

  const deployInfo: DeployInfo = new DeployInfo();
  before(async function () {
    await StrategyTestUtils.deployCoreAndInit(deployInfo, false);
  });

  // **********************************************
  // ************** CONFIG*************************
  // **********************************************
  const strategyContractName = strategyName;
  const vaultName = 'cone';

  const forwarderConfigurator = null;
  // only for strategies where we expect PPFS fluctuations
  const ppfsDecreaseAllowed = false;
  // only for strategies where we expect PPFS fluctuations
  const balanceTolerance = 0;
  const finalBalanceTolerance = 0;
  const deposit = 1_000;
  // at least 3
  const loops = 3;
  // number of blocks or timestamp value
  const loopValue = 60 * 60 * 24 * 7;
  // use 'true' if farmable platform values depends on blocks, instead you can use timestamp
  const advanceBlocks = false;
  const specificTests: SpecificStrategyTest[] = [];
  // **********************************************

  const deployer = async (signer: SignerWithAddress) => {
    const core = deployInfo.core as CoreContractsWrapper;
    return StrategyTestUtils.deploy(
      signer,
      core,
      vaultName,
      async vaultAddress => {
        const strategy = await DeployerUtilsLocal.deployStrategyProxy(
          signer,
          strategyContractName,
        ) as StrategyCone;
        const stacker = ConeStacker__factory.connect(ConeConstants.CONE_STACKER, signer);
        await stacker.changeDepositorStatus(strategy.address, true);
        await strategy.initialize(core.controller.address, underlying, vaultAddress, gauge, stacker.address);
        await strategy;
        return strategy;
      },
      underlying
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
    const doHardWork = new DoHardWorkLoopBase(
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
    // doHardWork.toClaimCheckTolerance = 0;
    return doHardWork;
  };

  await universalStrategyTest(
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
