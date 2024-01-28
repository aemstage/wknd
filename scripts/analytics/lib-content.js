/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/**
 * Customer's content dataset id
 * @type {string}
 */
const CONTENT_DATASET_ID = "65b25691b366902c6951cf0b";
/**
 * Assets views debounce timeout
 */
const ASSETS_VIEWS_DEBOUNCE_TIMEOUT = 5000;
/**
 * Assets views accumulator
 */
let assetViewsAcc = [];
/**
 * Debounces a function
 */
function debounce(func, timeout = ASSETS_VIEWS_DEBOUNCE_TIMEOUT) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

/**
 * Sends an analytics event to condor
 */
export function drainAssetsQueue() {
  if (assetViewsAcc.length) {
    analyticsTrackAssetsViews(assetViewsAcc);
    assetViewsAcc = [];
  }
}
const debouncedDrainAssetsQueue = debounce(() => drainAssetsQueue());

/**
 * Asset observer
 */
const assetObserver = window.IntersectionObserver
  ? new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .forEach((entry) => {
            assetObserver.unobserve(entry.target);
            assetViewsAcc.push(assetSrcURL(entry.target));
            debouncedDrainAssetsQueue();
          });
      },
      { threshold: 0.5 }
    )
  : { observe: () => {} };

/**
 * Default drain events
 */
window.addEventListener("visibilitychange", drainAssetsQueue);
window.addEventListener("pagehide", drainAssetsQueue);

/**
 * Return document last modified
 */
const dateTimeFormatOptions = [
  "en-US",
  { month: "2-digit", day: "2-digit", year: "numeric" },
];
export function getLastModified() {
  const lastModified = document.lastModified;
  if (lastModified) {
    const [month, day, year] = new Intl.DateTimeFormat(...dateTimeFormatOptions)
      .format(new Date(lastModified))
      .split("/");
    return `${year}-${month}-${day}`;
  }

  return undefined;
}

/**
 * Return helix experiment id: campaigns, experiments, audiences
 */
function getHelixExperimentId() {
  let servedExperiencePathname = undefined;
  if (window.hlx.campaign && window.hlx.campaign.servedExperience) {
    servedExperiencePathname = window.hlx.campaign.servedExperience;
  } else if (window.hlx.experiment && window.hlx.experiment.servedExperience) {
    servedExperiencePathname = window.hlx.experiment.servedExperience;
  } else if (window.hlx.audience && window.hlx.audience.servedExperience) {
    servedExperiencePathname = window.hlx.audience.servedExperience;
  }

  if (servedExperiencePathname) {
    if (servedExperiencePathname.endsWith("index.plain.html")) {
      servedExperiencePathname = servedExperiencePathname.slice(0, -14);
    }
    if (servedExperiencePathname.endsWith(".plain.html")) {
      servedExperiencePathname = servedExperiencePathname.slice(0, -11);
    }

    const url = new URL(window.location.href);
    url.pathname = servedExperiencePathname;
    url.search = "";
    return url.href;
  }
}

/**
 * Return experienceId
 */
function getExperienceId() {
  const pageURL = new URL(window.location.href);
  const helixURL = getHelixExperimentId();
  const experienceURL = helixURL || pageURL.href;
  const lastModified = getLastModified();
  return [experienceURL, lastModified].join("::");
}

/**
 * Extract asset url
 */
function assetSrcURL(element) {
  const value =
    element.currentSrc || element.src || element.getAttribute("src");
  if (value && value.startsWith("https://")) {
    // resolve relative links
    const srcURL = new URL(value, window.location);
    srcURL.search = "";
    return srcURL;
  }

  const srcURL = new URL(value);
  srcURL.search = "";
  return srcURL.href;
}

/**
 * Sends an analytics content event to alloy
 * @param xdmData - the xdm data object
 * @returns {Promise<*>}
 */
async function sendContentEvent(xdmData) {
  // eslint-disable-next-line no-undef
  if (!alloy) {
    console.warn("alloy not initialized, cannot send analytics event");
    return Promise.resolve();
  }

  // eslint-disable-next-line no-undef
  return alloy("sendEvent", {
    documentUnloading: false,
    xdm: xdmData,
    edgeConfigOverrides: {
      com_adobe_experience_platform: {
        datasets: { event: { datasetId: CONTENT_DATASET_ID } },
      },
    },
  });
}

/**
 * Basic tracking for assets views with alloy
 * @param assets - string[]
 * @returns {Promise<*>}
 */
async function analyticsTrackAssetsViews(assetsIDs) {
  const xdmData = {
    experienceContent: {
      experience: { experienceID: getExperienceId() },
      assetsIDs,
      contentEventType: "view",
    },
  };

  return sendContentEvent(xdmData);
}

/**
 * Basic tracking for assets clicks with alloy
 * @param assets - string[]
 * @param URL - string
 * @returns {Promise<*>}
 */
async function analyticsTrackAssetsClicked(assetsIDs, URL) {
  const xdmData = {
    eventType: "web.webinteraction.linkClicks",
    web: { webInteraction: { URL, linkClicks: { value: 1 }, type: "other" } }, // linkType can be 'download' or 'other'
    experienceContent: {
      experience: { experienceID: getExperienceId() },
      assetsIDs,
      contentEventType: "click",
    },
  };

  return sendContentEvent(xdmData);
}

export const registerAssetObserver = (assetElement) => {
  const tag = assetElement.tagName.toLowerCase();
  if (tag === "img" || tag === "video") {
    assetObserver.observe(assetElement);
  }
};

export const registerAssetClick = (assetElement, anchorElement) => {
  const tag = assetElement.tagName.toLowerCase();
  if (tag === "img" || tag === "video") {
    assetElement.addEventListener("click", () => {
      analyticsTrackAssetsClicked(
        [assetSrcURL(assetElement)],
        anchorElement.href
      );
    });
  }
};
