import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { join } from "path";

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const data = new Data(this, "Data");

    new Auth(this, "Auth");

    new IoT(this, "IoT", { dataTable: data.table });

    new Ticker(this, "Ticker", { dataTable: data.table });

    new Notifier(this, "Notifier", { dataTable: data.table });
  }
}

class Data extends Construct {
  public table: cdk.aws_dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.table = new cdk.aws_dynamodb.Table(this, "DataTable", {
      partitionKey: { name: "pk", type: cdk.aws_dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: cdk.aws_dynamodb.AttributeType.STRING },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: cdk.aws_dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });
    new cdk.CfnOutput(this, "DataTableName", {
      value: this.table.tableName,
    }).overrideLogicalId("DataTableName");
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
    }).overrideLogicalId("UserPoolId");

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
    }).overrideLogicalId("UserPoolClientId");

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
      value: identityPool.ref,
    }).overrideLogicalId("IdentityPoolId");

    const identityRole = new cdk.aws_iam.Role(this, "IdentityRole", {
      assumedBy: new cdk.aws_iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": `${identityPool.ref}`,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "unauthenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      inlinePolicies: {
        AllowMQTTAccess: new cdk.aws_iam.PolicyDocument({
          statements: [
            new cdk.aws_iam.PolicyStatement({
              actions: ["iot:Connect"],
              effect: cdk.aws_iam.Effect.ALLOW,
              resources: [
                cdk.Arn.format(
                  {
                    service: "iot",
                    resource: "client",
                    resourceName: "*",
                  },
                  cdk.Stack.of(this)
                ),
              ],
            }),
            new cdk.aws_iam.PolicyStatement({
              actions: ["iot:Receive", "iot:Publish", "iot:Subscribe"],
              effect: cdk.aws_iam.Effect.ALLOW,
              resources: [
                cdk.Arn.format(
                  {
                    service: "iot",
                    resource: "topic",
                    resourceName: "game",
                  },
                  cdk.Stack.of(this)
                ),
                cdk.Arn.format(
                  {
                    service: "iot",
                    resource: "topicfilter",
                    resourceName: "game",
                  },
                  cdk.Stack.of(this)
                ),
              ],
            }),
          ],
        }),
      },
    });

    new cdk.aws_cognito.CfnIdentityPoolRoleAttachment(
      this,
      "IdentityRoleAttachment",
      {
        identityPoolId: identityPool.ref,
        roles: {
          unauthenticated: identityRole.roleArn,
        },
      }
    );
  }
}

interface IoTProps {
  dataTable: cdk.aws_dynamodb.Table;
}

class IoT extends Construct {
  constructor(scope: Construct, id: string, props: IoTProps) {
    super(scope, id);

    const presenceFunction = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      "PresenceFunction",
      {
        handler: "handler",
        entry: join(__dirname, "../functions/presence/handler.ts"),
        environment: {
          DATA_TABLE_NAME: props.dataTable.tableName,
        },
      }
    );
    props.dataTable.grantWriteData(presenceFunction);

    new cdk.aws_iot.CfnTopicRule(this, "PresenceRule", {
      topicRulePayload: {
        actions: [{ lambda: { functionArn: presenceFunction.functionArn } }],
        sql: "SELECT * from '$aws/events/presence/+/+'",
        awsIotSqlVersion: "2016-03-23",
        errorAction: {
          cloudwatchLogs: {
            logGroupName: "testiotcore",
            roleArn: "arn:aws:iam::484156073071:role/service-role/testiotcore",
          },
        },
      },
    });
  }
}

interface TickerProps {
  dataTable: cdk.aws_dynamodb.Table;
}

class Ticker extends Construct {
  constructor(scope: Construct, id: string, props: TickerProps) {
    super(scope, id);

    const tickerFunction = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      "TickerFunction",
      {
        handler: "handler",
        entry: join(__dirname, "../functions/ticker/handler.ts"),
        environment: {
          DATA_TABLE_NAME: props.dataTable.tableName,
        },
      }
    );
    props.dataTable.grantWriteData(tickerFunction);

    new cdk.aws_events.Rule(this, "TickerRule", {
      schedule: cdk.aws_events.Schedule.rate(cdk.Duration.minutes(1)),
      targets: [
        new cdk.aws_events_targets.LambdaFunction(tickerFunction, {
          retryAttempts: 0,
          maxEventAge: cdk.Duration.seconds(60),
        }),
      ],
    });
  }
}

interface NotifierProps {
  dataTable: cdk.aws_dynamodb.Table;
}

class Notifier extends Construct {
  constructor(scope: Construct, id: string, props: NotifierProps) {
    super(scope, id);

    if (!props.dataTable.tableStreamArn) {
      throw new Error(`DynamoDB stream needs to be enabled on the data table`);
    }

    const normalizerFunction = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      "NormalizerFunction",
      {
        handler: "handler",
        entry: join(__dirname, "../functions/normalizer/handler.ts"),
      }
    );

    const notifierFunction = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      "NotifierFunction",
      {
        handler: "handler",
        entry: join(__dirname, "../functions/notifier/handler.ts"),
      }
    );

    const pipeRole = new cdk.aws_iam.Role(this, "PipeRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("pipes.amazonaws.com"),
    });
    props.dataTable.grantStreamRead(pipeRole);
    normalizerFunction.grantInvoke(pipeRole);
    notifierFunction.grantInvoke(pipeRole);

    new cdk.aws_pipes.CfnPipe(this, "NotificationsPipe", {
      roleArn: pipeRole.roleArn,
      source: props.dataTable.tableStreamArn,
      target: notifierFunction.functionArn,
      enrichment: normalizerFunction.functionArn,
      sourceParameters: {
        dynamoDbStreamParameters: {
          startingPosition: "LATEST",
          /**
           * To get the most up-to-date updated
           */
          batchSize: 1,
          maximumRetryAttempts: 0,
        },
      },
    });
  }
}
