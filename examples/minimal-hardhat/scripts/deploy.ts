
import { ethers as ethersLib } from "ethers";
import hre from "hardhat";

async function main() {
  // Get network configuration directly from user config (not resolved config)
  const networkConfig = hre.userConfig.networks?.hedera_testnet as any;
  if (!networkConfig || !networkConfig.url) {
    throw new Error("Network configuration not found");
  }

  // Create provider directly
  const provider = new ethersLib.JsonRpcProvider(String(networkConfig.url));

  // Create signer from private key in config
  const privateKey = networkConfig.accounts?.[0];

  if (!privateKey || typeof privateKey !== "string") {
    throw new Error(
      "No private key found in network accounts. Please add a private key to the accounts array in hardhat.config.ts",
    );
  }

  console.log("Private key:", privateKey.substring(0, 10) + "...");

  if (privateKey.length === 42 && privateKey.startsWith("0x")) {
    throw new Error(
      "The value in accounts appears to be an Ethereum address, not a private key. Please replace it with a valid private key.",
    );
  }

  let signer;
  try {
    signer = new ethersLib.Wallet(privateKey, provider);
  } catch (error) {
    console.error("Wallet creation error:", error);
    throw new Error(
      "Invalid private key. Please ensure it's a valid hex private key. For testing, you can generate one with: openssl rand -hex 32",
    );
  }

  console.log("Deploying contracts with account:", await signer.getAddress());

  // Get contract artifact
  const artifact = await hre.artifacts.readArtifact("Counter");

  // Deploy the Counter contract
  const Counter = new ethersLib.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    signer,
  );

  const counter = await Counter.deploy();
  await counter.waitForDeployment();

  const counterAddress = await counter.getAddress();
  console.log("Counter deployed to:", counterAddress);

  // Verify the deployment worked
  const count = await (counter as any).count();
  console.log("Initial counter value:", count.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
