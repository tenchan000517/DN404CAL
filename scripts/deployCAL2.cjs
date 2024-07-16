async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // ContractAllowListのデプロイ
  const ContractAllowList = await ethers.getContractFactory("ContractAllowList");
  const contractAllowList = await ContractAllowList.deploy([deployer.address]);
  await contractAllowList.deployed();
  console.log("ContractAllowList deployed to:", contractAllowList.address);

  // ContractAllowListProxyのデプロイ
  const ContractAllowListProxy = await ethers.getContractFactory("ContractAllowListProxy");
  const contractAllowListProxy = await ContractAllowListProxy.deploy(contractAllowList.address);
  await contractAllowListProxy.deployed();
  console.log("ContractAllowListProxy deployed to:", contractAllowListProxy.address);

  // デプロイ後のアドレスを使って検証
  console.log("Verifying ContractAllowList...");
  try {
    await hre.run("verify:verify", {
      address: contractAllowList.address,
      constructorArguments: [[deployer.address]]
    });
  } catch (e) {
    console.error("Verification failed:", e);
  }

  console.log("Verifying ContractAllowListProxy...");
  try {
    await hre.run("verify:verify", {
      address: contractAllowListProxy.address,
      constructorArguments: [contractAllowList.address]
    });
  } catch (e) {
    console.error("Verification failed:", e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
