import {ethers} from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ContractFactory} from "ethers";
import {CoreContractsWrapper} from "../../test/CoreContractsWrapper";
import {Addresses} from "../../addresses";
import {CoreAddresses} from "../models/CoreAddresses";
import {ToolsAddresses} from "../models/ToolsAddresses";
import axios from "axios";
import {RunHelper} from "../utils/tools/RunHelper";
import {config as dotEnvConfig} from "dotenv";
import {ToolsContractsWrapper} from "../../test/ToolsContractsWrapper";
import {Misc} from "../utils/tools/Misc";
import logSettings from "../../log_settings";
import {Logger} from "tslog";
import {BscAddresses} from "../addresses/BscAddresses";
import {readFileSync} from "fs";
import {
  IAnnouncer__factory,
  IBookkeeper__factory,
  IController,
  IController__factory,
  IFundKeeper__factory,
  IMintHelper__factory,
  IPriceCalculator__factory,
  IRewardToken__factory,
  ISmartVault,
  ISmartVault__factory,
  IStrategy,
  IStrategy__factory,
  IStrategySplitter,
  IStrategySplitter__factory,
  IVaultController,
  IVaultController__factory,
  TetuProxyControlled,
  TetuProxyControlled__factory,
} from "../../typechain";
import {deployContract} from "./DeployContract";
import {IFeeRewardForwarder__factory} from "../../typechain/factories/contracts/interfaces";

// tslint:disable-next-line:no-var-requires
const hre = require("hardhat");
const log: Logger = new Logger(logSettings);


dotEnvConfig();
// tslint:disable-next-line:no-var-requires
const argv = require('yargs/yargs')()
  .env('TETU')
  .options({
    networkScanKey: {
      type: "string",
    },
    vaultLogic: {
      type: "string",
      default: '0x3F3AcfD6A0765ef8854Ae81bC7Ef499Af0863090'
    },
    splitterLogic: {
      type: "string",
      default: "0x5d47c341f5F7786A9caC8B56ba84E673E2FdfE02"
    },
  }).argv;

const libraries = new Map<string, string>([
  ['SmartVault', 'VaultLibrary'],
  ['SmartVaultV110', 'VaultLibrary']
]);

export class DeployerUtilsLocal {

  public static coreCache: CoreContractsWrapper;
  public static toolsCache: ToolsContractsWrapper;

  public static getVaultLogic(signer: SignerWithAddress) {
    console.log('argv.vaultLogic', argv.vaultLogic);
    let logic = '';
    if (!!argv.vaultLogic) {
      logic = argv.vaultLogic;
    }
    return ISmartVault__factory.connect(logic, signer);
  }

  public static getSplitterLogic(signer: SignerWithAddress) {
    console.log('argv.splitterLogic', argv.splitterLogic);
    let logic = '';
    if (!!argv.splitterLogic) {
      logic = argv.splitterLogic;
    }
    return IStrategySplitter__factory.connect(logic, signer);
  }

  // ************ CONTRACT DEPLOY **************************

  public static async deployContract<T extends ContractFactory>(
    signer: SignerWithAddress,
    name: string,
    // tslint:disable-next-line:no-any
    ...args: any[]
  ) {
    return deployContract(hre, signer, name, ...args);
  }

  public static async deployTetuProxyControlled<T extends ContractFactory>(
    signer: SignerWithAddress,
    logicContractName: string,
  ) {
    const logic = await DeployerUtilsLocal.deployContract(signer, logicContractName);
    await DeployerUtilsLocal.wait(5);
    const proxy = await DeployerUtilsLocal.deployContract(signer, "TetuProxyControlled", logic.address);
    await DeployerUtilsLocal.wait(5);
    return [proxy, logic];
  }


  public static async deployStrategyProxy(signer: SignerWithAddress, strategyName: string): Promise<IStrategy> {
    const logic = await DeployerUtilsLocal.deployContract(signer, strategyName);
    await DeployerUtilsLocal.wait(1);
    const proxy = await DeployerUtilsLocal.deployContract(signer, "TetuProxyControlled", logic.address);
    return logic.attach(proxy.address) as IStrategy;
  }

  public static async deployStrategySplitter(signer: SignerWithAddress): Promise<IStrategySplitter> {
    const logic = DeployerUtilsLocal.getSplitterLogic(signer);
    const proxy = await DeployerUtilsLocal.deployContract(signer, "TetuProxyControlled", logic.address);
    return logic.attach(proxy.address) as IStrategySplitter;
  }


  public static async deployAndInitVaultAndStrategy<T>(
    underlying: string,
    vaultName: string,
    strategyDeployer: (vaultAddress: string) => Promise<IStrategy>,
    controller: IController,
    vaultController: IVaultController,
    vaultRewardToken: string,
    signer: SignerWithAddress,
    rewardDuration: number = 60 * 60 * 24 * 28, // 4 weeks
    depositFee = 0,
    wait = false
  ): Promise<[ISmartVault, ISmartVault, IStrategy]> {
    const start = Date.now();
    const vaultLogic = DeployerUtilsLocal.getVaultLogic(signer);
    const vaultProxy = await DeployerUtilsLocal.deployContract(signer, "TetuProxyControlled", vaultLogic.address) as TetuProxyControlled;
    const vault = vaultLogic.attach(vaultProxy.address) as ISmartVault;
    await RunHelper.runAndWait(() => vault.initializeSmartVault(
      "TETU_" + vaultName,
      "x" + vaultName,
      controller.address,
      underlying,
      rewardDuration,
      false,
      vaultRewardToken,
      depositFee
    ), true, wait);
    const strategy = await strategyDeployer(vault.address);
    Misc.printDuration(vaultName + ' vault initialized', start);

    await RunHelper.runAndWait(() => controller.addVaultsAndStrategies([vault.address], [strategy.address]), true, wait);
    await RunHelper.runAndWait(() => vaultController.setToInvest([vault.address], 1000), true, wait);
    Misc.printDuration(vaultName + ' deployAndInitVaultAndStrategy completed', start);
    return [vaultLogic, vault, strategy];
  }

  public static async deployVaultAndStrategy<T>(
    vaultName: string,
    strategyDeployer: (vaultAddress: string) => Promise<IStrategy>,
    controllerAddress: string,
    vaultRewardToken: string,
    signer: SignerWithAddress,
    rewardDuration: number = 60 * 60 * 24 * 28, // 4 weeks
    depositFee = 0,
    wait = false
  ): Promise<[ISmartVault, ISmartVault, IStrategy]> {
    const vaultLogic = DeployerUtilsLocal.getVaultLogic(signer);
    if (wait) {
      await DeployerUtilsLocal.wait(1);
    }
    log.info('vaultLogic ' + vaultLogic.address);
    const vaultProxy = await DeployerUtilsLocal.deployContract(signer, "TetuProxyControlled", vaultLogic.address);
    const vault = vaultLogic.attach(vaultProxy.address) as ISmartVault;

    const strategy = await strategyDeployer(vault.address);

    const strategyUnderlying = await strategy.underlying();

    await RunHelper.runAndWait(() => vault.initializeSmartVault(
      "TETU_" + vaultName,
      "x" + vaultName,
      controllerAddress,
      strategyUnderlying,
      rewardDuration,
      false,
      vaultRewardToken,
      depositFee
    ), true, wait);
    return [vaultLogic, vault, strategy];
  }

  public static async deployVaultWithSplitter(
    vaultName: string,
    signer: SignerWithAddress,
    controller: string,
    underlying: string,
    vaultRt: string,
    rewardDuration = 60 * 60 * 24 * 7
  ) {
    return DeployerUtilsLocal.deployVaultAndStrategy(
      vaultName,
      async (vaultAddress: string) => {
        console.log('Start deploy splitter')
        const splitter = await DeployerUtilsLocal.deployStrategySplitter(signer);
        console.log('Splitter init')
        await RunHelper.runAndWait(() => splitter.initialize(
          controller,
          underlying,
          vaultAddress,
        ));
        return IStrategy__factory.connect(splitter.address, signer);
      },
      controller,
      vaultRt,
      signer,
      rewardDuration,
      0
    );
  }

  public static async deployVaultAndStrategyProxy<T>(
    vaultName: string,
    underlying: string,
    strategyDeployer: (vaultAddress: string) => Promise<IStrategy>,
    controllerAddress: string,
    vaultRewardToken: string,
    signer: SignerWithAddress,
    rewardDuration: number = 60 * 60 * 24 * 28, // 4 weeks
    depositFee = 0,
    wait = false
  ): Promise<[ISmartVault, ISmartVault, IStrategy]> {
    const vaultLogic = DeployerUtilsLocal.getVaultLogic(signer);
    if (wait) {
      await DeployerUtilsLocal.wait(1);
    }
    log.info('vaultLogic ' + vaultLogic.address);
    const vaultProxy = await DeployerUtilsLocal.deployContract(signer, "TetuProxyControlled", vaultLogic.address);
    const vault = vaultLogic.attach(vaultProxy.address) as ISmartVault;

    await RunHelper.runAndWait(() => vault.initializeSmartVault(
      "TETU_" + vaultName,
      "x" + vaultName,
      controllerAddress,
      underlying,
      rewardDuration,
      false,
      vaultRewardToken,
      depositFee
    ), true, wait);

    if (wait) {
      await DeployerUtilsLocal.wait(1);
    }

    const strategy = await strategyDeployer(vault.address);
    return [vaultLogic, vault, strategy];
  }

  public static async deployDefaultNoopStrategyAndVault(
    signer: SignerWithAddress,
    controller: IController,
    vaultController: IVaultController,
    underlying: string,
    vaultRewardToken: string,
    rewardToken: string = ''
  ) {
    const netToken = await DeployerUtilsLocal.getNetworkTokenAddress();
    if (rewardToken === '') {
      rewardToken = netToken;
    }
    return DeployerUtilsLocal.deployAndInitVaultAndStrategy(
      underlying,
      't',
      vaultAddress => DeployerUtilsLocal.deployContract(
        signer,
        'NoopStrategy',
        controller.address, // _controller
        underlying, // _underlying
        vaultAddress,
        [rewardToken], // __rewardTokens
        [underlying], // __assets
        1 // __platform
      ) as Promise<IStrategy>,
      controller,
      vaultController,
      vaultRewardToken,
      signer
    );
  }

  public static async deployImpermaxLikeStrategies(
    signer: SignerWithAddress,
    controller: string,
    vaultAddress: string,
    underlying: string,
    strategyName: string,
    infoPath: string,
    minTvl = 2_000_000,
    buyBackRatio = 10_00,
  ) {

    const infos = readFileSync(infoPath, 'utf8').split(/\r?\n/);

    const strategies = [];

    for (const i of infos) {
      const info = i.split(',');
      const idx = info[0];
      const tokenName = info[2];
      const tokenAdr = info[3];
      const poolAdr = info[4];
      const tvl = info[5];

      if (+tvl < minTvl || idx === 'idx' || !tokenAdr || underlying.toLowerCase() !== tokenAdr.toLowerCase()) {
        // console.log('skip', idx, underlying, tokenAdr, +tvl);
        continue;
      }
      console.log('SubStrategy', idx, tokenName);

      const strategyArgs = [
        controller,
        vaultAddress,
        tokenAdr,
        poolAdr,
        buyBackRatio
      ];

      const deployedStart = await DeployerUtilsLocal.deployContract(
        signer,
        strategyName,
        ...strategyArgs
      ) as IStrategy;
      strategies.push(deployedStart.address);
    }
    console.log(' ================ IMPERMAX-LIKE DEPLOYED', strategies.length);
    return strategies;
  }

  // ************** VERIFY **********************

  public static async verify(address: string) {
    try {
      await hre.run("verify:verify", {
        address
      })
    } catch (e) {
      log.info('error verify ' + e);
    }
  }

  public static async verifyImpl(signer: SignerWithAddress, proxyAddress: string) {
    const proxy = TetuProxyControlled__factory.connect(proxyAddress, signer);
    const address = await proxy.implementation();
    console.log('impl address', address);
    try {
      await hre.run("verify:verify", {
        address
      })
    } catch (e) {
      log.info('error verify ' + e);
    }
    await this.verifyProxy(proxyAddress);
  }

  // tslint:disable-next-line:no-any
  public static async verifyWithArgs(address: string, args: any[]) {
    try {
      await hre.run("verify:verify", {
        address, constructorArguments: args
      })
    } catch (e) {
      log.info('error verify ' + e);
    }
  }

  // tslint:disable-next-line:no-any
  public static async verifyWithContractName(address: string, contractPath: string, args?: any[]) {
    try {
      await hre.run("verify:verify", {
        address, contract: contractPath, constructorArguments: args
      })
    } catch (e) {
      log.info('error verify ' + e);
    }
  }


  // tslint:disable-next-line:no-any
  public static async verifyImplWithContractName(signer: SignerWithAddress, proxyAddress: string, contractPath: string, args?: any[]) {
    const proxy = TetuProxyControlled__factory.connect(proxyAddress, signer);
    const address = await proxy.implementation();
    console.log('impl address', address);
    try {
      await hre.run("verify:verify", {
        address, contract: contractPath, constructorArguments: args
      })
    } catch (e) {
      log.info('error verify ' + e);
    }
    await this.verifyProxy(proxyAddress);
  }

  // tslint:disable-next-line:no-any
  public static async verifyWithArgsAndContractName(address: string, args: any[], contractPath: string) {
    try {
      await hre.run("verify:verify", {
        address, constructorArguments: args, contract: contractPath
      })
    } catch (e) {
      log.info('error verify ' + e);
    }
  }


  public static async verifyProxy(adr: string) {
    try {

      const resp =
        await axios.post(
          (await DeployerUtilsLocal.getNetworkScanUrl()) +
          `?module=contract&action=verifyproxycontract&apikey=${argv.networkScanKey}`,
          `address=${adr}`);
      // log.info("proxy verify resp", resp.data);
    } catch (e) {
      log.info('error proxy verify ' + adr + e);
    }
  }

  // ************** ADDRESSES **********************

  public static async getNetworkScanUrl(): Promise<string> {
    const net = (await ethers.provider.getNetwork());
    if (net.name === 'ropsten') {
      return 'https://api-ropsten.etherscan.io/api';
    } else if (net.name === 'kovan') {
      return 'https://api-kovan.etherscan.io/api';
    } else if (net.name === 'rinkeby') {
      return 'https://api-rinkeby.etherscan.io/api';
    } else if (net.name === 'ethereum') {
      return 'https://api.etherscan.io/api';
    } else if (net.name === 'matic') {
      return 'https://api.polygonscan.com/api'
    } else if (net.chainId === 80001) {
      return 'https://api-testnet.polygonscan.com/api'
    } else if (net.chainId === 250) {
      return 'https://api.ftmscan.com//api'
    } else {
      throw Error('network not found ' + net);
    }
  }

  public static async getCoreAddresses(): Promise<CoreAddresses> {
    const net = await ethers.provider.getNetwork();
    log.info('network ' + net.chainId);
    const core = Addresses.CORE.get(net.chainId + '');
    if (!core) {
      throw Error('No config for ' + net.chainId);
    }
    return core;
  }

  public static async getCoreAddressesWrapper(signer: SignerWithAddress): Promise<CoreContractsWrapper> {
    const net = await ethers.provider.getNetwork();
    log.info('network ' + net.chainId);
    const core = Addresses.CORE.get(net.chainId + '');
    if (!core) {
      throw Error('No config for ' + net.chainId);
    }

    const ps = ISmartVault__factory.connect(BscAddresses.ZERO_ADDRESS, signer);
    // const str = await ps.strategy();
    return new CoreContractsWrapper(
      IController__factory.connect(core.controller, signer),
      '',
      IFeeRewardForwarder__factory.connect(core.feeRewardForwarder, signer),
      '',
      IBookkeeper__factory.connect(core.bookkeeper, signer),
      '',
      IMintHelper__factory.connect(core.mintHelper, signer),
      '',
      IRewardToken__factory.connect(core.rewardToken, signer),
      ps,
      '',
      IStrategy__factory.connect(BscAddresses.ZERO_ADDRESS, signer),
      IFundKeeper__factory.connect(core.fundKeeper, signer),
      '',
      IAnnouncer__factory.connect(core.announcer, signer),
      '',
      IVaultController__factory.connect(core.vaultController, signer),
      '',
    );

  }

  public static async getToolsAddressesWrapper(signer: SignerWithAddress): Promise<ToolsContractsWrapper> {
    const net = await ethers.provider.getNetwork();
    log.info('network ' + net.chainId);
    const tools = Addresses.TOOLS.get(net.chainId + '');
    if (!tools) {
      throw Error('No config for ' + net.chainId);
    }
    return new ToolsContractsWrapper(
      IPriceCalculator__factory.connect(tools.calculator, signer),
    );

  }

  public static async getToolsAddresses(): Promise<ToolsAddresses> {
    const net = await ethers.provider.getNetwork();
    log.info('network ' + net.chainId);
    const tools = Addresses.TOOLS.get(net.chainId + '');
    if (!tools) {
      throw Error('No config for ' + net.chainId);
    }
    return tools;
  }

  public static async impersonate(address: string | null = null) {
    if (address === null) {
      address = await DeployerUtilsLocal.getGovernance();
    }
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address],
    });

    await hre.network.provider.request({
      method: "hardhat_setBalance",
      params: [address, "0x1431E0FAE6D7217CAA0000000"],
    });
    console.log('address impersonated', address);
    return ethers.getSigner(address || '');
  }

  public static async getDefaultNetworkFactory() {
    const net = await ethers.provider.getNetwork();
    if (net.chainId === 56) {
      return BscAddresses.PCS_FACTORY;
    } else {
      throw Error('No config for ' + net.chainId);
    }
  }

  public static async getUSDCAddress() {
    const net = await ethers.provider.getNetwork();
    if (net.chainId === 56) {
      return BscAddresses.USDC_TOKEN;
    } else {
      throw Error('No config for ' + net.chainId);
    }
  }

  public static async getNetworkTokenAddress() {
    const net = await ethers.provider.getNetwork();
    if (net.chainId === 56) {
      return BscAddresses.WBNB_TOKEN;
    } else {
      throw Error('No config for ' + net.chainId);
    }
  }

  public static async getTETUAddress() {
    const net = await ethers.provider.getNetwork();
    if (net.chainId === 56) {
      return BscAddresses.TETU_TOKEN;
    } else {
      throw Error('No config for ' + net.chainId);
    }
  }

  public static async getGovernance() {
    const net = await ethers.provider.getNetwork();
    if (net.chainId === 56) {
      return BscAddresses.GOV_ADDRESS;
    } else {
      throw Error('No config for ' + net.chainId);
    }
  }

  public static async getRouterByFactory(_factory: string) {
    const net = await ethers.provider.getNetwork();
    if (net.chainId === 56) {
      return BscAddresses.getRouterByFactory(_factory);
    } else {
      throw Error('No config for ' + net.chainId);
    }
  }

  public static async isNetwork(id: number) {
    return (await ethers.provider.getNetwork()).chainId === id;
  }

  public static async getStorageAt(address: string, index: string) {
    return ethers.provider.getStorageAt(address, index);
  }

  public static async setStorageAt(address: string, index: string, value: string) {
    await ethers.provider.send("hardhat_setStorageAt", [address, index, value]);
    await ethers.provider.send("evm_mine", []); // Just mines to the next block
  }

  public static async findVaultUnderlyingInBookkeeper(signer: SignerWithAddress, underlying: string) {
    const core = await DeployerUtilsLocal.getCoreAddressesWrapper(signer)
    const vaults = await core.bookkeeper.vaults();
    for (const vault of vaults) {
      const vaultUnd = await ISmartVault__factory.connect(vault, signer).underlying();
      if (vaultUnd.toLowerCase() === underlying.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  // ****************** WAIT ******************

  public static async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public static async wait(blocks: number) {
    if (hre.network.name === 'hardhat') {
      return;
    }
    const start = ethers.provider.blockNumber;
    while (true) {
      log.info('wait 10sec');
      await DeployerUtilsLocal.delay(10000);
      if (ethers.provider.blockNumber >= start + blocks) {
        break;
      }
    }
  }


}
