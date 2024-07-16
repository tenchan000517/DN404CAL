const hre = require("hardhat");
const path = require('path');

async function main() {
  const contractName = "NFTMintDN4040622";
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Deploying contract: ${contractName}`);
  console.log(`Running script from: ${path.resolve(__dirname)}`);
  console.log(`Script file: ${path.basename(__filename)}`);
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // コンストラクタ引数を追加
  const Contract = await hre.ethers.getContractFactory(contractName);
  const contract = await Contract.deploy(
    "TESTDN404", // NFTの名前
    "TEST404",   // NFTのシンボル
    // "https://nft-mint.xyz/data/tenplatemetadata/",
    "0x0000000000000000000000000000000000000000000000000000000000000000", // ホワイトリストのルートハッシュ
    0,           // パブリックプライス
    0,           // ホワイトリストプライス
    1,         // 初期トークン供給量
    // 10000,        // 総供給量の上限
    // deployer.address, // 初期供給所有者のアドレス
    // 1000,        // 一つのウォレットに対する最大NFT購入数
    // 10000        // 総供給量の上限
    "0xdbaa28cBe70aF04EbFB166b1A3E8F8034e5B9FC7"
  );

  await contract.deployed();

  console.log("Contract address:", contract.address);
  console.log("Deployment transaction hash:", contract.deployTransaction.hash);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
