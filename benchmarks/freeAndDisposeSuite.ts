import { Suite } from "benchmark";
import type { createObjectBuffer as createObjectBufferType } from "../src";

// @ts-expect-error arbitrary json
import K1000RowsMockData from "./fixtures/MOCK_DATA.json";
import type { BenchmarkTest } from "./interfaces";

const MIN_SAMPLES = 5;

global.testTargetIndex = 0;
global.testTargets = [];

export function freeAndDisposeSuite(
  createObjectBuffer: typeof createObjectBufferType
) {
  const tests: BenchmarkTest[] = [
    {
      name: `object memory free. K1000RowsMockData, pre-created OB, size: 1e6`,
      fn: () => {
        // delete prop from pre created objectbuffer
        // will free the memory in use for K1000RowsMockData
        delete global.testTargets[global.testTargetIndex].K1000RowsMockData;

        global.testTargetIndex += 1;
      },
      options: {
        minSamples: MIN_SAMPLES,
        /**
         * pre-create empty object buffers
         */
        onStart() {
          global.testTargetIndex = 0;
          global.testTargets = [];

          for (let i = 0; i < 300; i++) {
            global.testTargets.push(
              createObjectBuffer({}, 1e6, { K1000RowsMockData })
            );
          }

          if (typeof global.gc !== "undefined") {
            global.gc();
          }
        },
        onComplete() {
          global.testTargetIndex = 0;
          global.testTargets = [];
          if (typeof global.gc !== "undefined") {
            global.gc();
          }
        },
      },
    },
  ];

  const suite = new Suite("freeAndDisposeSuite");

  for (const t of tests) {
    suite.add(t.name, t.fn, t.options);
  }

  suite
    .on("cycle", (event: any) => {
      console.log(String(event.target));
    })
    .on("complete", () => {
      //
      // process.toString();
    });

  return suite;
}
