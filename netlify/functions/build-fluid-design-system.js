const { builder } = require("@netlify/functions");

const scaleSteps = {
  "minor-second": 1.067,
  "major-second": 1.125,
  "minor-third": 1.2,
  "major-third": 1.25,
  "perfect-fourth": 1.333,
  "augmented-fourth": 1.414,
  "perfect-fifth": 1.5,
  "golden-ratio": 1.618,
  "major-sixth": 1.667,
  "minor-seventh": 1.778,
  "major-seventh": 1.875,
  octave: 2,
};

function round(num) {
  return Math.round(num * 100) / 100;
}

function clampBuilder(minWidthPx, maxWidthPx, minSizePx, maxSizePx) {
  const pixelsPerRem = 16;

  const minWidth = minWidthPx / pixelsPerRem;
  const maxWidth = maxWidthPx / pixelsPerRem;

  const minSize = minSizePx / pixelsPerRem;
  const maxSize = maxSizePx / pixelsPerRem;

  const slope = (maxSize - minSize) / (maxWidth - minWidth);
  const yAxisIntersection = -minWidth * slope + minSize;

  const min = `${round(minSize)}rem`;
  const val = `${round(yAxisIntersection)}rem + ${round(slope * 100)}vw`;
  const max = `${round(maxSize)}rem`;

  return `clamp(${min}, ${val}, ${max})`;
}

function generateCSS(system) {
  let css = "";

  const { typeScale, spaceSteps, spacePairs, customPairs } = system;

  for (const step of Object.keys(typeScale)) {
    css += `--step-${step}: ${typeScale[step].clamp};`;
  }

  for (const step of Object.keys(spaceSteps)) {
    css += `--space${step.toLowerCase()}: ${spaceSteps[step].clamp};`;
  }

  for (const step of Object.keys(spacePairs)) {
    css += `--space${step.toLowerCase()}: ${spacePairs[step].clamp};`;
  }

  for (const step of Object.keys(customPairs)) {
    css += `--space${step.toLowerCase()}: ${customPairs[step].clamp};`;
  }

  return css;
}

function buildFluidDesignSystem(opts) {
  const {
    minViewport,
    maxViewport,
    typeScaleSteps,
    spaceSteps,
    spacePairs,
    customPairs,
  } = opts;

  const minFluidTypeStep = typeScaleSteps[0];
  const maxFluidTypeStep = typeScaleSteps[typeScaleSteps.length - 1];

  const system = {
    typeScale: {},
    spaceSteps: {},
    spacePairs: {},
    customPairs: {},
  };

  for (let i = minFluidTypeStep; i <= maxFluidTypeStep; i++) {
    const valueMin = round(
      minViewport.fontSize * Math.pow(scaleSteps[minViewport.typeScale], i)
    );
    const valueMax = round(
      maxViewport.fontSize * Math.pow(scaleSteps[maxViewport.typeScale], i)
    );

    system.typeScale[i] = {
      min: valueMin,
      max: valueMax,
      clamp: clampBuilder(
        minViewport.width,
        maxViewport.width,
        valueMin,
        valueMax
      ),
    };
  }

  for (const step of Object.keys(spaceSteps)) {
    const stepValue = spaceSteps[step];
    const valueMin = round(system.typeScale[0].min * stepValue);
    const valueMax = round(system.typeScale[0].max * stepValue);

    system.spaceSteps[step] = {
      min: valueMin,
      max: valueMax,
      clamp: clampBuilder(
        minViewport.width,
        maxViewport.width,
        valueMin,
        valueMax
      ),
    };
  }

  for (const [min, max] of Object.entries(spacePairs)) {
    const valueMin = system.spaceSteps[min].min;
    const valueMax = system.spaceSteps[max].max;

    system.spacePairs[`${min}${max}`] = {
      min: valueMin,
      max: valueMax,
      clamp: clampBuilder(
        minViewport.width,
        maxViewport.width,
        valueMin,
        valueMax
      ),
    };
  }

  for (const [min, max] of Object.entries(customPairs)) {
    const valueMin = system.spaceSteps[min].min;
    const valueMax = system.spaceSteps[max].max;

    system.customPairs[`${min}${max}`] = {
      min: valueMin,
      max: valueMax,
      clamp: clampBuilder(
        minViewport.width,
        maxViewport.width,
        valueMin,
        valueMax
      ),
    };
  }

  return {
    ...system,
    generateCSS() {
      return generateCSS(system);
    },
  };
}

async function handler(event, context) {
  const urlParts = event.path.split("/");

  const systemConfigRaw = urlParts.slice(2, urlParts.length);

  const config = {
    minViewport: {
      width: parseInt(systemConfigRaw[0]),
      fontSize: parseInt(systemConfigRaw[1]),
      typeScale: systemConfigRaw[2],
    },
    maxViewport: {
      width: parseInt(systemConfigRaw[3]),
      fontSize: parseInt(systemConfigRaw[4]),
      typeScale: systemConfigRaw[5],
    },
  };

  const fluidDesignSystem = buildFluidDesignSystem({
    ...config,
    typeScaleSteps: [-2, -1, 0, 1, 2, 3, 4, 5],
    spaceSteps: {
      "-3XS": 0.25,
      "-2XS": 0.5,
      "-XS": 0.75,
      "-S": 1,
      "-M": 1.5,
      "-L": 2,
      "-XL": 3,
      "-2XL": 4,
      "-3XL": 6,
      "-4XL": 8,
    },
    spacePairs: {
      "-3XS": "-2XS",
      "-2XS": "-XS",
      "-XS": "-S",
      "-S": "-M",
      "-M": "-L",
      "-L": "-XL",
      "-XL": "-2XL",
      "-2XL": "-3XL",
    },
    customPairs: {
      "-S": "-L",
    },
  });

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/css",
    },
    body: `
      :where(html) {
        ${fluidDesignSystem.generateCSS()}
      }
    `,
  };
}

exports.handler = builder(handler);
