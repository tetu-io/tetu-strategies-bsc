import {DeployerUtilsLocal} from "../../deploy/DeployerUtilsLocal";
import {Multicall, Multicall__factory} from "../../../typechain";
import {ethers} from "hardhat";
import {Logger} from "tslog";
import Common from "ethereumjs-common";
import logSettings from "../../../log_settings";

const log: Logger = new Logger(logSettings);

const MATIC_CHAIN = Common.forCustomChain(
  'mainnet', {
    name: 'matic',
    networkId: 137,
    chainId: 137
  },
  'petersburg'
);

const FANTOM_CHAIN = Common.forCustomChain(
  'mainnet', {
    name: 'fantom',
    networkId: 250,
    chainId: 250
  },
  'petersburg'
);

export class Misc {
  public static readonly SECONDS_OF_DAY = 60 * 60 * 24;
  public static readonly SECONDS_OF_YEAR = Misc.SECONDS_OF_DAY * 365;
  public static readonly ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  public static readonly GEIST_BOR_RATIO = 0.95;
  public static readonly AAVE_BOR_RATIO = 0.99;
  public static readonly IRON_BOR_RATIO = 0.99;
  public static readonly MAX_UINT = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

  public static printDuration(text: string, start: number) {
    log.info('>>>' + text, ((Date.now() - start) / 1000).toFixed(1), 'sec');
  }

  public static async getBlockTsFromChain(): Promise<number> {
    const signer = (await ethers.getSigners())[0];
    const tools = await DeployerUtilsLocal.getToolsAddresses();
    const ctr = Multicall__factory.connect(tools.multicall, signer);
    const ts = await ctr.getCurrentBlockTimestamp();
    return ts.toNumber();
  }

  public static async getChainConfig() {
    const net = await ethers.provider.getNetwork();
    switch (net.chainId) {
      case 137:
        return MATIC_CHAIN;
      case 250:
        return FANTOM_CHAIN;
      default:
        throw new Error('Unknown net ' + net.chainId)
    }
  }

}
