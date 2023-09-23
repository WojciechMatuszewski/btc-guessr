import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { join } from "path";

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new cdk.CfnOutput(this, "Region", {
      value: cdk.Stack.of(this).region,
    }).overrideLogicalId("Region");

    /**
     * To fetch the endpoint we have to make a HTTP call.
     * To my best knowledge, there is no other way to get the IoT endpoint address.
     */
    const iotEndpointCustomResource =
      new cdk.custom_resources.AwsCustomResource(
        this,
        "iotEndpointCustomResource",
        {
          onCreate: {
            service: "Iot",
            action: "DescribeEndpoint",
            parameters: {
              endpointType: "iot:Data-ATS",
            },
            physicalResourceId:
              cdk.custom_resources.PhysicalResourceId.fromResponse(
                "endpointAddress"
              ),
          },
          policy: cdk.custom_resources.AwsCustomResourcePolicy.fromSdkCalls({
            resources:
              cdk.custom_resources.AwsCustomResourcePolicy.ANY_RESOURCE,
          }),
        }
      );

    new cdk.CfnOutput(this, "IotEndpoint", {
      value: `wss://${iotEndpointCustomResource.getResponseField(
        "endpointAddress"
      )}`,
    }).overrideLogicalId("IotEndpoint");

    const data = new Data(this, "Data");

    new Auth(this, "Auth");

    new Presence(this, "Presence", { dataTable: data.table });

    new Ticker(this, "Ticker", { dataTable: data.table });

    new Notifier(this, "Notifier", { dataTable: data.table });

    new Api(this, "Api", { dataTable: data.table });

    new ScoreDistributor(this, "ScoreDistributor", { dataTable: data.table });

    if (process.env["NO_HOSTING"] !== "true") {
      new Website(this, "Website");
    }
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

    this.table.addGlobalSecondaryIndex({
      indexName: "ByUserStatus",
      partitionKey: {
        name: "gsi1pk",
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
    });
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

interface PresenceProps {
  dataTable: cdk.aws_dynamodb.Table;
}

class Presence extends Construct {
  constructor(scope: Construct, id: string, props: PresenceProps) {
    super(scope, id);

    const disconnecterFunction = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      "DisconnecterFunction",
      {
        handler: "handler",
        entry: join(__dirname, "../functions/presence/disconnecter.handler.ts"),
        environment: {
          DATA_TABLE_NAME: props.dataTable.tableName,
        },
      }
    );
    props.dataTable.grantWriteData(disconnecterFunction);

    const disconnectionsQueue = new cdk.aws_sqs.Queue(
      this,
      "DisconnectionsQueue"
    );
    new cdk.CfnOutput(this, "DisconnectionsQueueUrl", {
      value: disconnectionsQueue.queueUrl,
    }).overrideLogicalId("DisconnectionsQueueUrl");

    disconnecterFunction.addEventSource(
      new cdk.aws_lambda_event_sources.SqsEventSource(disconnectionsQueue)
    );

    const presenceFunction = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      "PresenceFunction",
      {
        handler: "handler",
        entry: join(__dirname, "../functions/presence/handler.ts"),
        environment: {
          DATA_TABLE_NAME: props.dataTable.tableName,
          DISCONNECTIONS_QUEUE_URL: disconnectionsQueue.queueUrl,
        },
      }
    );
    props.dataTable.grantWriteData(presenceFunction);
    disconnectionsQueue.grantSendMessages(presenceFunction);

    const subscriptionRule = new cdk.aws_iot.CfnTopicRule(
      this,
      "SubscriptionPresenceRule",
      {
        topicRulePayload: {
          actions: [{ lambda: { functionArn: presenceFunction.functionArn } }],
          sql: "SELECT * from '$aws/events/subscriptions/+/+'",
          awsIotSqlVersion: "2016-03-23",
        },
      }
    );
    presenceFunction.addPermission("AllowSubscriptionPresenceRuleInvoke", {
      principal: new cdk.aws_iam.ServicePrincipal("iot.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: subscriptionRule.attrArn,
    });

    const connectionRule = new cdk.aws_iot.CfnTopicRule(
      this,
      "ConnectionPresenceRule",
      {
        topicRulePayload: {
          actions: [{ lambda: { functionArn: presenceFunction.functionArn } }],
          sql: "SELECT * from '$aws/events/presence/disconnected/+'",
          awsIotSqlVersion: "2016-03-23",
        },
      }
    );
    presenceFunction.addPermission("AllowConnectionPresenceRuleInvoke", {
      principal: new cdk.aws_iam.ServicePrincipal("iot.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: connectionRule.attrArn,
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
        timeout: cdk.Duration.seconds(10),
      }
    );
    props.dataTable.grantReadWriteData(tickerFunction);

    new cdk.aws_events.Rule(this, "TickerRule", {
      schedule: cdk.aws_events.Schedule.rate(cdk.Duration.minutes(1)),
      enabled: true,
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
        environment: {
          DATA_TABLE_NAME: props.dataTable.tableName,
        },
        timeout: cdk.Duration.seconds(10),
      }
    );
    props.dataTable.grantReadData(normalizerFunction);

    const notifierFunction = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      "NotifierFunction",
      {
        handler: "handler",
        entry: join(__dirname, "../functions/notifier/handler.ts"),
      }
    );
    notifierFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ["iot:Publish"],
        resources: [
          /**
           * TODO: Seems like one has to specify a '*' here?
           */
          "*",
        ],
      })
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

interface ApiProps {
  dataTable: cdk.aws_dynamodb.Table;
}

class Api extends Construct {
  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    const predictFunction = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      "PredictFunction",
      {
        handler: "handler",
        entry: join(__dirname, "../functions/api/predict.handler.ts"),
        environment: {
          DATA_TABLE_NAME: props.dataTable.tableName,
        },
      }
    );
    props.dataTable.grantReadWriteData(predictFunction);

    const gameFunction = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      "StateFunction",
      {
        handler: "handler",
        entry: join(__dirname, "../functions/api/game.handler.ts"),
        environment: {
          DATA_TABLE_NAME: props.dataTable.tableName,
        },
      }
    );
    props.dataTable.grantReadData(gameFunction);

    const api = new cdk.aws_apigateway.RestApi(this, "Api", {
      defaultCorsPreflightOptions: {
        allowOrigins: cdk.aws_apigateway.Cors.ALL_ORIGINS,
        allowHeaders: cdk.aws_apigateway.Cors.DEFAULT_HEADERS,
        allowMethods: cdk.aws_apigateway.Cors.ALL_METHODS,
      },
    });

    const gameResource = api.root.addResource("game");
    gameResource.addMethod(
      "GET",
      new cdk.aws_apigateway.LambdaIntegration(gameFunction)
    );
    new cdk.CfnOutput(this, "GameEndpointUrl", {
      value: api.urlForPath(gameResource.path),
    }).overrideLogicalId("GameEndpointUrl");

    const predictResource = gameResource
      .addResource("{gameId}")
      .addResource("predict");

    predictResource.addMethod(
      "POST",
      new cdk.aws_apigateway.LambdaIntegration(predictFunction)
    );
    new cdk.CfnOutput(this, "PredictEndpointUrl", {
      value: api.urlForPath(predictResource.path),
    }).overrideLogicalId("PredictEndpointUrl");
  }
}

interface ScoreSummarizerProps {
  dataTable: cdk.aws_dynamodb.Table;
}

class ScoreDistributor extends Construct {
  constructor(scope: Construct, id: string, props: ScoreSummarizerProps) {
    super(scope, id);

    const distributorFunction = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      "Sum",
      {
        handler: "handler",
        entry: join(__dirname, "../functions/distributor/handler.ts"),
        environment: {
          DATA_TABLE_NAME: props.dataTable.tableName,
        },
        timeout: cdk.Duration.seconds(10),
      }
    );
    props.dataTable.grantReadWriteData(distributorFunction);

    distributorFunction.addEventSource(
      new cdk.aws_lambda_event_sources.DynamoEventSource(props.dataTable, {
        retryAttempts: 0,
        startingPosition: cdk.aws_lambda.StartingPosition.LATEST,
        filters: [
          cdk.aws_lambda.FilterCriteria.filter({
            dynamodb: {
              NewImage: {
                pk: { S: [{ prefix: "GAME#" }] },
                sk: { S: ["RESULT"] },
              },
            },
          }),
        ],
      })
    );
  }
}

class Website extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const websiteBucket = new cdk.aws_s3.Bucket(this, "WebsiteBucket", {
      websiteIndexDocument: "index.html",
      publicReadAccess: true,
      autoDeleteObjects: true,
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ACLS,
      accessControl: cdk.aws_s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      /**
       * Special case.
       * It seems like this constructs somehow runs BEFORE the aspect to apply this setting is run.
       */
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    new cdk.CfnOutput(this, "WebsiteAddress", {
      value: websiteBucket.bucketWebsiteUrl,
    }).overrideLogicalId("WebsiteAddress");

    new cdk.CfnOutput(this, "WebsiteBucketName", {
      value: websiteBucket.bucketName,
    }).overrideLogicalId("WebsiteBucketName");
  }
}
