/* tslint:disable:variable-name */
// noinspection SpellCheckingInspection
// noinspection JSUnusedGlobalSymbols

export class BscAddresses {

  // useful places where you can find addresses
  // https://github.com/sushiswap/default-token-list/blob/master/src/tokens/matic.json#L153

  public static ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  public static GOV_ADDRESS = "0xf00fD5282538F1C81df9F8388023FFDB3565c0D4".toLowerCase();
  public static CONTROLLER_ADDRESS = "0xe926a29f531AC36A0D635a5494Fd8474b9a663aD".toLowerCase();

  // tokens
  public static WBNB_TOKEN = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c".toLowerCase();
  public static WETH_TOKEN = "0x2170ed0880ac9a755fd29b2688956bd959f933f8".toLowerCase();
  public static USDC_TOKEN = "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d".toLowerCase();
  public static FRAX_TOKEN = "0x90c97f71e18723b0cf0dfa30ee176ab653e89f40".toLowerCase();
  public static DAI_TOKEN = "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3".toLowerCase();
  public static USDT_TOKEN = "0x55d398326f99059ff775485246999027b3197955".toLowerCase();
  public static MAI_TOKEN = "0x3f56e0c36d275367b8c502090edf38289b3dea0d".toLowerCase();
  public static BUSD_TOKEN = "0xe9e7cea3dedca5984780bafc599bd69add087d56".toLowerCase();
  public static TETU_TOKEN = "0x1f681b1c4065057e07b95a1e5e504fb2c85f4625".toLowerCase();
  public static CONE_TOKEN = "0xA60205802E1B5C6EC1CAFA3cAcd49dFeECe05AC9".toLowerCase();
  public static USDPlus_TOKEN = "0xe80772Eaf6e2E18B651F160Bc9158b2A5caFCA65".toLowerCase();
  public static UNKWN_TOKEN = "0xD7FbBf5CB43b4A902A8c994D94e821f3149441c7".toLowerCase();
  public static VALAS_TOKEN = "0xB1EbdD56729940089Ecc3aD0BBEEB12b6842ea6F".toLowerCase();
  public static BIFI_TOKEN = "0xCa3F508B8e4Dd382eE878A314789373D80A5190A".toLowerCase();
  public static TUSD_TOKEN = "0x14016e85a25aeb13065688cafb43044c2ef86784".toLowerCase();
  public static MDBPlus_TOKEN = "0x9f8bb16f49393eea4331a39b69071759e54e16ea".toLowerCase();
  public static QI_TOKEN = "0xddc3d26baa9d2d979f5e2e42515478bf18f354d5".toLowerCase();


  // PCS
  public static PCS_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73".toLowerCase();
  public static PCS_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E".toLowerCase();

  // CONE
  public static CONE_FACTORY = "0x0EFc2D2D054383462F2cD72eA2526Ef7687E1016".toLowerCase();
  public static CONE_ROUTER = "0xbf1fc29668e5f5Eaa819948599c9Ac1B1E03E75F".toLowerCase();

  public static CONE_V_CONE_BNB_PAIR = "0x672cd8201ceb518f9e42526ef7bcfe5263f41951".toLowerCase();
  public static CONE_V_CONE_BNB_GAUGE = "0x09635bd2F4aA47afc7eB9d2F03c4fE4e747D4B42".toLowerCase();

  public static CONE_S_USDT_USDC_PAIR = "0x68dda7c12f792e17c747a627d41153c103310d74".toLowerCase();
  public static CONE_S_USDT_USDC_GAUGE = "0x32258f716720ea65d6ae11b0aaf1692cdefe6f9f".toLowerCase();


  public static getRouterByFactory(factory: string): string {
    switch (factory.toLowerCase()) {
      case BscAddresses.CONE_FACTORY:
        return BscAddresses.CONE_ROUTER;
      case BscAddresses.PCS_FACTORY:
        return BscAddresses.PCS_ROUTER;
    }
    throw Error('Unknown factory ' + factory);
  }

  public static getRouterName(router: string): string {
    switch (router.toLowerCase()) {
      case BscAddresses.CONE_ROUTER:
        return 'CONE';
    }
    throw Error('Unknown router ' + router);
  }
}
