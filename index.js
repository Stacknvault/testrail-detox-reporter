"use strict";

const process = require("process"),
  path = require("path"),
  chalk = require("chalk");
const DEFAULT_CONFIG_FILENAME = "testrail.conf.js";
const configPath = path.resolve(process.cwd(), DEFAULT_CONFIG_FILENAME);
const error = chalk.bold.red;
const warning = chalk.keyword("orange");
const message = chalk.bold.green;
const {
  baseUrl,
  regex,
  milestone,
  project_id,
  suite_mode,
  user,
  pass,
} = require(configPath);
const Utils = require("./src/utils");
const caller = require("./src/caller");

class CustomTestrailReporter {
  constructor(_globalConfig, _options) {
    this._globalConfig = _globalConfig;
    this._options = {};
    this._options.milestone = (_options && _options.milestone) || milestone;
    this._options.baseUrl = (_options && _options.baseUrl) || baseUrl;
    this._options.project_id = (_options && _options.project_id) || project_id;
    this._options.suite_mode = (_options && _options.suite_mode) || suite_mode;
    this._options.run_update =
      _options && _options.hasOwnProperty("publish_results")
        ? _options.publish_results
        : true;
    this._options.auth =
      "Basic " + new Buffer.from(user + ":" + pass, "utf-8").toString("base64");
    caller.init(this._options);
    this._utils = new Utils({
      regex: regex || null,
      statuses: _options && _options.statuses,
    });
    this.results = [];

    // Log _options and milestone
    console.log(message("Constructor _options:"), _options);
    console.log(message("Constructor milestone:"), milestone);
  }

  onRunStart(_results, _options) {
    console.log(
      message("Testrail Jest Reporter is running..."),
      JSON.stringify(this._options, null, 2)
    );
    if (
      this._options.project_id &&
      !isNaN(this._options.project_id) &&
      this._options.milestone
    ) {
      caller.get_milestone_id();
      //   caller.add_run();
    } else {
      console.log(error(`! Testrail Jest Reporter Error !`));
      console.log(
        warning(`You must define "project_id"  and "milestone" in jest configurations!
                \n Example: "reporters": [ ["testrail-jest-reporter", { "project_id": "1", "milestone": "Sprint 1" }] ]`)
      );
    }
  }

  onTestStart(_test) {}

  onTestResult(_test, _testResults, _aggregatedResult) {
    // Log _testResults.testResults
    console.log(message("_testResults.testResults:"), _testResults.testResults);

    if (caller._milestone_id) {
      _testResults.testResults.forEach((result) => {
        const testcases = this._utils.formatCase(result);
        console.log(message(`Testrail test cases...`), testcases);
        if (testcases) {
          for (let i = 0, len = testcases.length; i < len; i++) {
            this.results.push(testcases[i]);
          }
        }
      });
      console.log("RESULTS", this.results);
    }
  }

  onRunComplete(_contexts, _results) {
    // Log this.results
    console.log(message("onRunComplete results:"), this.results);

    if (caller._milestone_id) {
      console.log(
        message("Testrail Jest Reporter is updating tests results...")
      );
      caller
        .get_tests()
        .then(() => {
          return caller.add_results(this.results);
        })
        .then((response) => {
          console.log(message("add_results response:"), response);
          if (response && typeof response === "object") {
            const { tests_count, runs_count } = response;
            if (tests_count)
              console.log(
                message(
                  `\nTestrail Jest Reporter updated ${tests_count} tests in ${runs_count} runs.`
                )
              );
          } else {
            console.log(error("Invalid response from add_results"));
          }
        })
        .catch((e) => {
          console.log(error(`! Testrail Jest Reporter Error !\n${e.stack}`));
        });
    }
  }

  getLastError() {
    if (this._shouldFail) {
      return new Error("Testrail Jest Reporter reported an error");
    }
  }
}

module.exports = CustomTestrailReporter;
