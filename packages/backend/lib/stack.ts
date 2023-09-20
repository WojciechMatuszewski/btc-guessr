import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }
}

class Auth extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const userPool = new cdk.aws_cognito.UserPool(this, "UserPool", {
      passwordPolicy: {
        minLength: 6,
        requireDigits: false,
        requireLowercase: false,
        requireSymbols: false,
        requireUppercase: false,
      },
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
    });
    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });

    const userPoolClient = new cdk.aws_cognito.UserPoolClient(
      this,
      "UserPoolClient",
      {
        authFlows: {
          userPassword: true,
          userSrp: true,
        },
        generateSecret: false,
        supportedIdentityProviders: [
          cdk.aws_cognito.UserPoolClientIdentityProvider.COGNITO,
        ],
        userPool,
      }
    );
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });

    const identityPool = new cdk.aws_cognito.CfnIdentityPool(
      this,
      "IdentityPool",
      {
        allowUnauthenticatedIdentities: true,
        cognitoIdentityProviders: [
          {
            clientId: userPoolClient.userPoolClientId,
            providerName: userPool.userPoolProviderName,
          },
        ],
      }
    );
    new cdk.CfnOutput(this, "IdentityPoolId", {
      value: identityPool.attrId,
    });

    const identityRole = new cdk.aws_iam.Role(this, "IdentityRole", {
      assumedBy: new cdk.aws_iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {},
        "sts:AssumeRoleWithWebIdentity"
      ),
      inlinePolicies: {
        AllowMQTTAccess: new cdk.aws_iam.PolicyDocument({
          statements: [
            new cdk.aws_iam.PolicyStatement({
              actions: [
                "iot:Connect",
                "iot:Subscribe",
                "iot:Receive",
                "iot:Publish",
              ],
              effect: cdk.aws_iam.Effect.ALLOW,
              resources: [],
            }),
          ],
        }),
      },
    });

    new cdk.aws_cognito.CfnIdentityPoolRoleAttachment(
      this,
      "IdentityRoleAttachment",
      {
        identityPoolId: identityPool.attrId,
        roles: {
          authenticated: identityRole.roleArn,
          unauthenticated: identityRole.roleArn,
        },
      }
    );
  }
}
