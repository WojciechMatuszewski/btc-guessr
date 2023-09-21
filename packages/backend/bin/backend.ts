import * as cdk from "aws-cdk-lib";
import { BackendStack } from "./stack";

const app = new cdk.App();

new BackendStack(app, "BTCGuessr", {
  synthesizer: new cdk.DefaultStackSynthesizer({
    qualifier: "btcguessr",
  }),
});
