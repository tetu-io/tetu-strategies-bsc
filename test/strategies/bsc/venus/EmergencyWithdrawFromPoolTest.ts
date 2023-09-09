import {SpecificStrategyTest} from "../../SpecificStrategyTest";
import {TokenUtils} from "../../../TokenUtils";
import {IStrategy, ISmartVault} from "../../../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {DeployInfo} from "../../DeployInfo";
import {VaultUtils} from "../../../VaultUtils";
import {utils} from "ethers";

const {expect} = chai;
chai.use(chaiAsPromised);

export class EmergencyWithdrawFromPoolTest extends SpecificStrategyTest {

  public async do(
    deployInfo: DeployInfo
  ): Promise<void> {
    it("Emergency withdraw from Pool", async () => {
      const underlying = deployInfo?.underlying as string;
      const signer = deployInfo?.signer as SignerWithAddress;
      const user = deployInfo?.user as SignerWithAddress;
      const vault = deployInfo?.vault as ISmartVault;
      const strategy = deployInfo.strategy as IStrategy;

      console.log('>>>emergencyWithdrawFromPool test');
      const userAddress = user.address
      const depositAmount = await TokenUtils.balanceOf(underlying, userAddress);

      await VaultUtils.deposit(user, vault, depositAmount);

      const strategyGov = strategy.connect(signer);
      await strategyGov.emergencyExit({gasLimit: 19_000_000});
      const withdrawnAmount = await TokenUtils.balanceOf(underlying, strategy.address);
      console.log('>>>withdrawnAmount   ', withdrawnAmount.toString());
      expect(withdrawnAmount).is.approximately
      const undDec = await TokenUtils.decimals(underlying);
      expect(+utils.formatUnits(depositAmount, undDec)).is.approximately(+utils.formatUnits(withdrawnAmount, undDec), 0.000001, 'withdrawn less than deposited');
    });
  }
}
