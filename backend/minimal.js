import { Deepgram } from "@deepgram/sdk";
const deepgram = new Deepgram("YOUR_API_KEY");
const dgStream = await deepgram.transcription.live({
  language: "nl",
  encoding: "oggopus",
  sample_rate: 48000,
});
dgStream.addListener("transcriptReceived", (data) =>
  console.log(data.channel.alternatives[0].transcript)
);
dgStream.send(Buffer.alloc(8192)); // Stuur een lege buffer voor test
dgStream.finish();
