import {
  IControllableExtended__factory,
  IController,
  IController__factory,
  IERC20__factory,
  ISmartVault,
  IStrategy__factory,
  IStrategySplitter__factory
} from "../typechain";
import {expect} from "chai";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {TokenUtils} from "./TokenUtils";
import {BigNumber, ContractTransaction, utils} from "ethers";
import axios from "axios";
import {CoreContractsWrapper} from "./CoreContractsWrapper";
import {MintHelperUtils} from "./MintHelperUtils";
import {Misc} from "../scripts/utils/tools/Misc";
import {ethers} from "hardhat";
import {formatUnits} from "ethers/lib/utils";
import {BscAddresses} from "../scripts/addresses/BscAddresses";

export const XTETU_NO_INCREASE = new Set<string>([
  'VenusSupplyStrategyBase'
])
export const VAULT_SHARE_NO_INCREASE = new Set<string>([])

export class VaultUtils {

  constructor(public vault: ISmartVault) {
  }

  public static async profitSharingRatio(controller: IController): Promise<number> {
    const ratio = (await controller.psNumerator()).toNumber()
      / (await controller.psDenominator()).toNumber();
    expect(ratio).is.not.lessThan(0);
    expect(ratio).is.not.greaterThan(100);
    return ratio;
  }

  public static async deposit(
    user: SignerWithAddress,
    vault: ISmartVault,
    amount: BigNumber,
    invest = true
  ): Promise<ContractTransaction> {
    const vaultForUser = vault.connect(user);
    const underlying = await vaultForUser.underlying();
    const dec = await TokenUtils.decimals(underlying);
    const bal = await TokenUtils.balanceOf(underlying, user.address);
    console.log('balance', utils.formatUnits(bal, dec), bal.toString());
    expect(+utils.formatUnits(bal, dec))
      .is.greaterThanOrEqual(+utils.formatUnits(amount, dec), 'not enough balance')

    const undBal = await vaultForUser.underlyingBalanceWithInvestment();
    const totalSupply = await IERC20__factory.connect(vault.address, user).totalSupply();
    if (!totalSupply.isZero() && undBal.isZero()) {
      throw new Error("Wrong underlying balance! Check strategy implementation for _rewardPoolBalance()");
    }

    await TokenUtils.approve(underlying, user, vault.address, amount.toString());
    console.log('Vault utils: deposit', BigNumber.from(amount).toString());
    if (invest) {
      return vaultForUser.depositAndInvest(BigNumber.from(amount));
    } else {
      return vaultForUser.deposit(BigNumber.from(amount));
    }
  }

  public static async doHardWorkAndCheck(vault: ISmartVault, positiveCheck = true) {
    console.log('/// start do hard work')
    const start = Date.now();
    const controller = await IControllableExtended__factory.connect(vault.address, vault.signer).controller();
    const controllerCtr = IController__factory.connect(controller, vault.signer);
    const und = await vault.underlying();
    const undDec = await TokenUtils.decimals(und);
    const rt = (await vault.rewardTokens())[0];
    const psRatio = (await controllerCtr.psNumerator()).toNumber() / (await controllerCtr.psDenominator()).toNumber()
    const strategy = await vault.strategy();
    const strategyCtr = IStrategy__factory.connect(strategy, vault.signer);
    const ppfsDecreaseAllowed = await vault.ppfsDecreaseAllowed();

    const ppfs = +utils.formatUnits(await vault.getPricePerFullShare(), undDec);

    const undBal = +utils.formatUnits(await vault.underlyingBalanceWithInvestment(), undDec);
    let rtBal: number = 0;
    if (rt) {
      rtBal = +utils.formatUnits(await TokenUtils.balanceOf(rt, vault.address));
    } else {
      rtBal = 0;
    }
    const strategyPlatform = (await strategyCtr.platform());
    if (strategyPlatform === 24) {
      console.log('splitter dohardworks');
      const splitter = IStrategySplitter__factory.connect(strategy, vault.signer);
      const subStrategies = await splitter.allStrategies();
      for (const subStrategy of subStrategies) {
        console.log('Call substrategy dohardwork', await IStrategy__factory.connect(subStrategy, vault.signer).STRATEGY_NAME())
        await IStrategy__factory.connect(subStrategy, vault.signer).doHardWork();
      }
    } else {
      await vault.doHardWork();
    }
    console.log('hard work called');

    const ppfsAfter = +utils.formatUnits(await vault.getPricePerFullShare(), undDec);
    const undBalAfter = +utils.formatUnits(await vault.underlyingBalanceWithInvestment(), undDec);
    const bbRatio = (await strategyCtr.buyBackRatio()).toNumber();
    let rtBalAfter: number = 0;
    if (rt) {
      rtBalAfter = +utils.formatUnits(await TokenUtils.balanceOf(rt, vault.address));
    }

    console.log('-------- HARDWORK --------');
    console.log('- BB ratio:', bbRatio);
    console.log('- Vault Share price:', ppfsAfter);
    console.log('- Vault Share price change:', ppfsAfter - ppfs);
    console.log('- Vault und balance change:', undBalAfter - undBal);
    console.log('- Vault first RT change:', rtBalAfter - rtBal);
    console.log('- PS ratio:', psRatio);
    console.log('--------------------------');

    if (positiveCheck) {
      if (bbRatio !== 10000 && !ppfsDecreaseAllowed) {
        // it is a unique case where we send profit to vault instead of AC
        const strategyName = await strategyCtr.STRATEGY_NAME();
        if (!VAULT_SHARE_NO_INCREASE.has(strategyName)) {
          expect(ppfsAfter).is.greaterThan(ppfs, 'With not 100% buybacks we should autocompound underlying asset');
        }
      }
    }
    Misc.printDuration('doHardWorkAndCheck completed', start);
  }

}
