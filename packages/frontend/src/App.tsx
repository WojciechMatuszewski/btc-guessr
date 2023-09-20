import { AWSIoTProvider } from "@aws-amplify/pubsub";
import { Amplify, PubSub } from "aws-amplify";
import { useEffect } from "react";

Amplify.configure({
  Auth: {
    identityPoolId: "xx",
    region: "xx",
    userPoolId: "Xx",
    userPoolWebClientId: "xx",
  },
});

Amplify.addPluggable(
  new AWSIoTProvider({
    aws_pubsub_region: "xx",
    aws_pubsub_endpoint: "xx",
    clientId: "mqtt-explorer-" + Math.floor(Math.random() * 100000 + 1),
  })
);

function App() {
  useEffect(() => {
    const sub = PubSub.subscribe("game").subscribe(console.log);
    return () => {
      sub.unsubscribe();
    };
  }, []);
  return <div>works</div>;
}

export default App;
