const hre = require("hardhat");
const { LAYERZERO_ENDPOINT_ID, USDC_TOKEN } = require('./addresses_lookup')
const { encodeAbiParameters } = require('viem')

async function main() {
  const [deployer] = await ethers.getSigners();

  const StargateCoverDispatcher = await hre.ethers.getContractFactory("StargateCoverDispatcher");
  const stargateCoverDispatcher = await StargateCoverDispatcher
    .attach('0x2cC44580004Aa4Eb7A6E5c934C2022b29790743D');  //Dispatcher on Base

  const usdcAmount = '100000';

  const buyCoverTypes = [
    {name: 'coverId', type: 'uint256'},
    {name: 'owner', type: 'address'},
    {name: 'productId', type: 'uint24'},
    {name: 'coverAsset', type: 'uint8'},
    {name: 'amount', type: 'uint96'},
    {name: 'period', type: 'uint32'},
    {name: 'maxPremiumInAsset', type: 'uint256'},
    {name: 'paymentAsset', type: 'uint8'}
  ];
  const composeValues = [
    0,                                                      // coverId
    deployer.address,                                       // owner
    1,                                                      // productId
    1,                                                      // coverAsset
    100,                                                   // amount
    1 * 24 * 3600,                                         // period
    100,                                                   // maxPremiumInAsset, NXM amount we buy
    '1',                                                     // paymentAsset
  ];
  const composeMsg = encodeAbiParameters(
    buyCoverTypes,
    composeValues
  );

  const zippingMsg = await stargateCoverDispatcher.prepareZipping(
    '0x27a16dc786820B16E5c9028b75B99F6f604b5d26',         //Base USDC pool
    [
      LAYERZERO_ENDPOINT_ID.arbitrumOne,                  //TO Arbitrum
      LAYERZERO_ENDPOINT_ID.gnosis,                       //TO Gnosis
    ],
    [usdcAmount, usdcAmount],
    [
      '0xcd9ab5494caa6f017e4a7ffb2586ae0a3fed2234',       //RECEIVER on Arbitrum
      '0x29e3A72e5d51Ad7aA92c3adE093974956ACa30FF'        //RECEIVER on Gnosis
    ],
    [composeMsg, composeMsg]
  );
  console.log("Zipping message:", zippingMsg[0]);

  /*const USDC = await hre.ethers.getContractFactory("ERC20");
  const usdc = await USDC
    .attach(USDC_TOKEN.base);
  await usdc.approve(stargateCoverDispatcher.address,usdcAmount);*/

  //Note: requires USDC approval to the dispatcher
  const totalValueToSend = zippingMsg[0][0] + zippingMsg[0][1];
  await stargateCoverDispatcher.zipCovers(
    '0x27a16dc786820B16E5c9028b75B99F6f604b5d26',         //Base USDC pool
    [
      [
      zippingMsg[1][0].dstEid,
      zippingMsg[1][0].to,
      zippingMsg[1][0].amountLD.toString(),
      zippingMsg[1][0].minAmountLD.toString(),
      zippingMsg[1][0].extraOptions,
      zippingMsg[1][0].composeMsg,
      zippingMsg[1][0].oftCmd
    ], [
      zippingMsg[1][1].dstEid,
      zippingMsg[1][1].to,
      zippingMsg[1][1].amountLD.toString(),
      zippingMsg[1][1].minAmountLD.toString(),
      zippingMsg[1][1].extraOptions,
      zippingMsg[1][1].composeMsg,
      zippingMsg[1][1].oftCmd
    ]
    ],
    [
      [
      zippingMsg[2][0].nativeFee.toString(),
      zippingMsg[2][0].lzTokenFee.toString(),
    ], [
      zippingMsg[2][1].nativeFee.toString(),
      zippingMsg[2][1].lzTokenFee.toString(),
    ]
    ],
    [
      zippingMsg[0][0].toString(),
      zippingMsg[0][1].toString()
    ]
  , {value: totalValueToSend.toString()})
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
