import * as cdk from "aws-cdk-lib";
import { BackendStack } from "./stack";
import { IConstruct } from "constructs";

const app = new cdk.App();

const stack = new BackendStack(app, "BTCGuessr", {
  synthesizer: new cdk.DefaultStackSynthesizer({
    qualifier: "btcguessr",
  }),
});

class AddRemovalPolicyToEveryResource implements cdk.IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof cdk.CfnResource) {
      node.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    }
  }
}

cdk.Aspects.of(stack).add(new AddRemovalPolicyToEveryResource());
