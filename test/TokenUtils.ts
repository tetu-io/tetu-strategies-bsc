import {ethers} from "hardhat";
import {
  IController__factory,
  IERC20__factory, IERC20Extended__factory,
  ISmartVault__factory,
  IWmatic__factory
} from "../typechain";
import {BigNumber} from "ethers";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BscAddresses} from "../scripts/addresses/BscAddresses";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {DeployerUtilsLocal} from "../scripts/deploy/DeployerUtilsLocal";
import {Misc} from "../scripts/utils/tools/Misc";
import {parseUnits} from "ethers/lib/utils";

const {expect} = chai;
chai.use(chaiAsPromised);

export class TokenUtils {

  // use the most neutral place, some contracts (like swap pairs) can be used in tests and direct transfer ruin internal logic
  public static TOKEN_HOLDERS = new Map<string, string>([
    [BscAddresses.CONE_V_CONE_BNB_PAIR, BscAddresses.CONE_V_CONE_BNB_GAUGE.toLowerCase()],
    [BscAddresses.CONE_S_USDT_USDC_PAIR, BscAddresses.CONE_S_USDT_USDC_GAUGE.toLowerCase()],
    ['0x0f8c95890b7bdecfae7990bf32f22120111e0b44', '0x965b78533a72d2a18fa31f3449887572e9a54a1e'.toLowerCase()],
    [BscAddresses.USDC_TOKEN, '0x8894e0a0c962cb723c1976a4421c95949be2d4e3'.toLowerCase()], // binance hot wallet
    [BscAddresses.USDT_TOKEN, '0x8894e0a0c962cb723c1976a4421c95949be2d4e3'.toLowerCase()], // binance hot wallet
    [BscAddresses.CONE_TOKEN, '0xd0c1378c177e961d96c06b0e8f6e7841476c81ef'.toLowerCase()], // ve
    [BscAddresses.BTCB, '0x5a52E96BAcdaBb82fd05763E25335261B270Efcb'.toLowerCase()], // binance hot wallet
    [BscAddresses.WETH_TOKEN, '0x5a52E96BAcdaBb82fd05763E25335261B270Efcb'.toLowerCase()], // binance hot wallet
    [BscAddresses.DAI_TOKEN, '0xF977814e90dA44bFA03b6295A0616a897441aceC'.toLowerCase()], // binance hot wallet
  ]);

  public static async balanceOf(tokenAddress: string, account: string): Promise<BigNumber> {
    if (tokenAddress.toLowerCase() === BscAddresses.ZERO_ADDRESS) {
      return BigNumber.from(0);
    }
    console.log('balanceOf', tokenAddress, account)
    return IERC20__factory.connect(tokenAddress, ethers.provider).balanceOf(account);
  }

  public static async totalSupply(tokenAddress: string): Promise<BigNumber> {
    return IERC20__factory.connect(tokenAddress, ethers.provider).totalSupply();
  }

  public static async approve(tokenAddress: string, signer: SignerWithAddress, spender: string, amount: string) {
    console.log('approve', await TokenUtils.tokenSymbol(tokenAddress), amount);
    return IERC20__factory.connect(tokenAddress, signer).approve(spender, BigNumber.from(amount));
  }

  public static async allowance(tokenAddress: string, signer: SignerWithAddress, spender: string): Promise<BigNumber> {
    return IERC20__factory.connect(tokenAddress, signer).allowance(signer.address, spender);
  }

  public static async transfer(tokenAddress: string, signer: SignerWithAddress, destination: string, amount: string) {
    console.log('transfer', await TokenUtils.tokenSymbol(tokenAddress), amount);
    return IERC20__factory.connect(tokenAddress, signer).transfer(destination, BigNumber.from(amount))
  }

  public static async wrapNetworkToken(signer: SignerWithAddress, amount: string) {
    const token = IWmatic__factory.connect(await DeployerUtilsLocal.getNetworkTokenAddress(), signer);
    return token.deposit({value: parseUnits(amount), from: signer.address});
  }

  public static async decimals(tokenAddress: string): Promise<number> {
    return IERC20Extended__factory.connect(tokenAddress, ethers.provider).decimals();
  }

  public static async tokenName(tokenAddress: string): Promise<string> {
    return IERC20Extended__factory.connect(tokenAddress, ethers.provider).name();
  }

  public static async tokenSymbol(tokenAddress: string): Promise<string> {
    return IERC20Extended__factory.connect(tokenAddress, ethers.provider).symbol();
  }

  public static async checkBalance(tokenAddress: string, account: string, amount: string) {
    const bal = await TokenUtils.balanceOf(tokenAddress, account);
    expect(bal.gt(BigNumber.from(amount))).is.eq(true, 'Balance less than amount');
    return bal;
  }

  public static async getToken(token: string, to: string, amount?: BigNumber) {
    const start = Date.now();
    console.log('transfer token from biggest holder', token, amount?.toString());

    if (token.toLowerCase() === await DeployerUtilsLocal.getNetworkTokenAddress()) {
      await IWmatic__factory.connect(token, await DeployerUtilsLocal.impersonate(to)).deposit({value: amount});
      return amount;
    }
    if (token.toLowerCase() === BscAddresses.TETU_TOKEN) {
      console.log('Mint TETU')
      const minter = await DeployerUtilsLocal.impersonate('0xDe829c03b442912D0e29822dE06032e937F172BB')
      await IERC20Extended__factory.connect(token, minter).mint(to, amount || parseUnits('1000000'))
      return amount;
    }
    const owner = await DeployerUtilsLocal.impersonate(to);
    if ((await IController__factory.connect(BscAddresses.CONTROLLER_ADDRESS, owner).isValidVault(token))) {
      const vault = ISmartVault__factory.connect(token, owner);
      const underlying = await vault.underlying();
      const ppfs = await vault.getPricePerFullShare();
      const dec = await IERC20Extended__factory.connect(token, owner).decimals();
      const a = amount?.mul(ppfs).div(parseUnits('1', dec)).mul(2) || BigNumber.from(Misc.MAX_UINT);
      await TokenUtils.getToken(underlying, to, a);
      await IERC20__factory.connect(underlying, owner).approve(token, Misc.MAX_UINT);
      await vault.deposit(a);
      return a;
    }

    const holder = TokenUtils.TOKEN_HOLDERS.get(token.toLowerCase()) as string;
    if (!holder) {
      throw new Error('Please add holder for ' + token);
    }
    const signer = await DeployerUtilsLocal.impersonate(holder);
    const balance = (await TokenUtils.balanceOf(token, holder)).div(100);
    console.log('holder balance', balance.toString());
    if (amount) {
      await TokenUtils.transfer(token, signer, to, amount.toString());
    } else {
      await TokenUtils.transfer(token, signer, to, balance.toString());
    }
    Misc.printDuration('getToken completed', start);
    return balance;
  }

}
