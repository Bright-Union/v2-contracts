const hre = require("hardhat");
const { Options, addressToBytes32 } = require('@layerzerolabs/lz-v2-utilities')
const { ethers } = require('ethers')



async function main() {

  const [deployer] = await hre.ethers.getSigners();
  const BrightOFTAdapter = await hre.ethers.getContractFactory("BrightOFTAdapter");
  const oftAdapter = BrightOFTAdapter.attach(
    "0x781b40005b308ff254e891f1a552271dd1ed12a6" // The deployed contract address
  );

  const toAddress = '0xC6AC25a9edefb3368710c0Aef5fC387691CA0e3A';
  const eidB = '30145'; //gnosis
  const amount = '100000000000000000000'; //100
  let options = Options.newOptions().addExecutorLzReceiveOption(70000, 0).toBytes();

  const sendParam = {
    dstEid: eidB,
    to: addressToBytes32(toAddress),
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: options,
    composeMsg: ethers.getBytes('0x'), // Assuming no composed message
    oftCmd: ethers.getBytes('0x'), // Assuming no OFT command is needed
  };

  const feeQuote = await oftAdapter.quoteSend(sendParam, false);
  const nativeFee = feeQuote.nativeFee;
  console.log(
    `sending ${amount} token(s) to network ${eidB})`,
  );

  //assuming 'approve' is done
  const r = await oftAdapter.send(sendParam, {nativeFee: nativeFee, lzTokenFee: 0}, deployer.address, {
    value: nativeFee,
  });
  console.log(`Send tx initiated. See: https://layerzeroscan.com/tx/${r.hash}`);


}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
