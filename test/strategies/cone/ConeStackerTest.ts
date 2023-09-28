import chai from "chai";
import chaiAsPromised from "chai-as-promised";

import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {DeployerUtilsLocal} from "../../../scripts/deploy/DeployerUtilsLocal";
import {
  ConeStacker,
  ConeStacker__factory, IERC721__factory, IVe, IVe__factory
} from "../../../typechain";
import {BscAddresses} from "../../../scripts/addresses/BscAddresses";
import {TimeUtils} from "../../TimeUtils";
import {TokenUtils} from "../../TokenUtils";
import {parseUnits} from "ethers/lib/utils";


const {expect} = chai;
chai.use(chaiAsPromised);

describe('cone stacker tests', async () => {

  let snapshotBefore: string;
  let snapshot: string;
  let signer: SignerWithAddress;

  let coneStacker: ConeStacker;
  let ve: IVe;
  let veId: number;

  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    signer = await DeployerUtilsLocal.impersonate();
    const core = await DeployerUtilsLocal.getCoreAddresses()

    coneStacker = ConeStacker__factory.connect((await DeployerUtilsLocal.deployTetuProxyControlled(signer, 'ConeStacker'))[0].address, signer);
    await coneStacker.initialize(core.controller);

    await TokenUtils.getToken(BscAddresses.CONE_TOKEN, signer.address, parseUnits('100'));
    ve = IVe__factory.connect('0xd0C1378c177E961D96c06b0E8F6E7841476C81Ef', signer)
    await TokenUtils.approve(BscAddresses.CONE_TOKEN, signer, ve.address, parseUnits('100').toString());
    veId = (await ve.callStatic.createLock(parseUnits('1'), 60 * 60 * 24 * 30)).toNumber();
    await ve.createLock(parseUnits('1'), 60 * 60 * 24 * 30);
  });

  beforeEach(async function () {
    snapshot = await TimeUtils.snapshot();
  });

  afterEach(async function () {
    await TimeUtils.rollback(snapshot);
  });

  after(async function () {
    await TimeUtils.rollback(snapshotBefore);
  });

  it("merge", async function () {
    await TokenUtils.transfer(BscAddresses.CONE_TOKEN, signer, coneStacker.address, parseUnits('1').toString());
    await coneStacker.lock(parseUnits('1'), false)
    await IERC721__factory.connect(ve.address, signer).transferFrom(signer.address, coneStacker.address, veId);
    await coneStacker.merge(veId);
  });
});
