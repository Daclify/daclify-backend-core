"""Reproduce the planning model using decimal USD; no network or product writes."""

import csv
import json
from decimal import Decimal, ROUND_CEILING
from pathlib import Path

ROOT = Path(__file__).resolve().parent
D = Decimal
INPUTS = json.loads((ROOT / "assumptions.json").read_text())
RATES = {name: D(value) for name, value in INPUTS["rates"].items()}
FIXED_INPUTS = {name: D(value) for name, value in INPUTS["cooperativeFixedMonthly"].items()}
FIXED = sum(value for name, value in FIXED_INPUTS.items() if name != "operatorHours")
FIXED += FIXED_INPUTS["operatorHours"] * RATES["operatorHourly"]
PLATFORM = {name: D(value) for name, value in INPUTS["platform"].items()}
ACQUISITION = {name: D(value) for name, value in INPUTS["acquisition"].items()}


def unit(scenario):
    s = {name: D(value) for name, value in scenario.items() if name != "name"}
    model = sum(s[tokens] * RATES[rate] / D(1_000_000) for tokens, rate in [
        ("standardInputTokens", "standardInputPerMillion"),
        ("standardOutputTokens", "standardOutputPerMillion"),
        ("lightInputTokens", "lightInputPerMillion"),
        ("lightOutputTokens", "lightOutputPerMillion"),
    ])
    search = s["searchRequests"] * RATES["searchPerRequest"]
    technology = (model + search + s["incrementalInfrastructure"]) * s["retryMultiplier"]
    labor = s["operatorMinutes"] / D(60) * RATES["operatorHourly"]
    retained = s["price"] * (1 - s["refundFraction"])
    processing = s["price"] * RATES["processingFraction"] + RATES["processingFixed"]
    platform_fee = retained * RATES["platformTakeFraction"]
    contribution = retained - processing - platform_fee - technology - labor
    coefficient = (1 - s["refundFraction"]) * (1 - RATES["platformTakeFraction"]) - RATES["processingFraction"]
    return {
        "name": scenario["name"], "price": s["price"], "refundFraction": s["refundFraction"],
        "inferenceBeforeRetries": model, "searchBeforeRetries": search,
        "technologyWithRetries": technology, "operatorLabor": labor,
        "retainedRevenue": retained, "processing": processing, "platformFee": platform_fee,
        "contribution": contribution, "contributionFractionOfGross": contribution / s["price"],
        "fixedMonthly": FIXED,
        "breakEvenJobs": None if contribution <= 0 else (FIXED / contribution).to_integral_value(rounding=ROUND_CEILING),
        "priceFloorVariable": (technology + labor + RATES["processingFixed"]) / coefficient,
        "priceFloorAt100Jobs": (technology + labor + RATES["processingFixed"] + FIXED / 100) / coefficient,
        "priceFor30PercentMarginAt100Jobs": (technology + labor + RATES["processingFixed"] + FIXED / 100) / (coefficient - D("0.30")),
    }


def platform_month(jobs, base):
    jobs = D(jobs)
    subscription = PLATFORM["proposedSubscription"]
    revenue = subscription + jobs * base["platformFee"]
    cost = PLATFORM["infrastructurePerCooperative"] + PLATFORM["supportHoursPerCooperative"] * RATES["operatorHourly"]
    cost += subscription * RATES["processingFraction"] + RATES["processingFixed"]
    contribution = revenue - cost
    replacement_cac = PLATFORM["cooperativeAcquisitionCost"] * PLATFORM["monthlyCooperativeChurn"]
    after_cac = contribution - replacement_cac
    return {"jobsPerCooperative": jobs, "grossServiceGMV": jobs * base["price"],
            "platformRevenuePerCooperative": revenue, "platformCostPerCooperative": cost,
            "platformContributionPerCooperative": contribution,
            "breakEvenCooperatives": None if contribution <= 0 else (PLATFORM["fixedOperatingMonthly"] / contribution).to_integral_value(rounding=ROUND_CEILING),
            "replacementAcquisitionPerCooperative": replacement_cac,
            "contributionAfterReplacementAcquisition": after_cac,
            "breakEvenCooperativesAfterAcquisition": None if after_cac <= 0 else (PLATFORM["fixedOperatingMonthly"] / after_cac).to_integral_value(rounding=ROUND_CEILING)}


def serial(value):
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, dict):
        return {name: serial(item) for name, item in value.items()}
    if isinstance(value, list):
        return [serial(item) for item in value]
    return value


def write_csv(name, rows):
    with (ROOT / name).open("w", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(serial(rows))


def main():
    scenarios = [unit(scenario) for scenario in INPUTS["scenarios"]]
    base = next(row for row in scenarios if row["name"] == "base")
    assert base["inferenceBeforeRetries"] == D("0.63")
    assert base["technologyWithRetries"] == D("1.225")
    assert base["contribution"] == D("33.2765")
    assert base["breakEvenJobs"] == 24 and FIXED == 779
    assert next(row for row in scenarios if row["name"] == "stress")["contribution"] == D("-1.7460")
    assert unit({**INPUTS["scenarios"][1], "refundFraction": "1"})["contribution"] < 0
    volumes = []
    for jobs in [10, 25, 100, 500]:
        customers = D(jobs) / ACQUISITION["jobsPerCustomerMonthly"]
        replacement_cac = customers * ACQUISITION["monthlyCustomerChurn"] * ACQUISITION["customerAcquisitionCost"]
        surplus = jobs * base["contribution"] - FIXED
        volumes.append({"jobs": jobs, "customerEquivalents": customers, "grossRevenue": jobs * base["price"],
                        "surplusBeforeAcquisitionAndTax": surplus, "replacementAcquisition": replacement_cac,
                        "surplusAfterReplacementAcquisitionBeforeTax": surplus - replacement_cac})
    sensitivity = []
    for price in [5, 19, 29, 49, 79]:
        for minutes in [0, 3, 12, 30, 60]:
            row = unit({**INPUTS["scenarios"][1], "price": str(price), "operatorMinutes": str(minutes)})
            sensitivity.append({"price": price, "operatorMinutes": minutes, "contribution": row["contribution"],
                                "surplusAt100JobsBeforeAcquisitionAndTax": 100 * row["contribution"] - FIXED})
    platform_rows = [platform_month(jobs, base) for jobs in [10, 25, 100, 500]]
    assert platform_month(100, base)["breakEvenCooperatives"] == 56
    assert platform_month(100, base)["breakEvenCooperativesAfterAcquisition"] == 65
    customer_contribution = base["contribution"] * ACQUISITION["jobsPerCustomerMonthly"]
    acquisition_per_job = ACQUISITION["monthlyCustomerChurn"] * ACQUISITION["customerAcquisitionCost"] / ACQUISITION["jobsPerCustomerMonthly"]
    member_rewards = []
    for reward in [0, 8, 20, 40]:
        remaining = base["contribution"] - acquisition_per_job - reward
        member_rewards.append({"additionalRewardPerJob": reward,
                               "contributionAfterRewardAndReplacementAcquisition": remaining,
                               "surplusAt100JobsBeforeTax": 100 * remaining - FIXED,
                               "breakEvenJobsAfterAcquisition": None if remaining <= 0 else (FIXED / remaining).to_integral_value(rounding=ROUND_CEILING)})
    assert [row["breakEvenJobsAfterAcquisition"] for row in member_rewards] == [26, 34, 71, None]
    runway = 3 * FIXED + 100 * (base["technologyWithRetries"] + base["operatorLabor"])
    runway += 100 * base["price"] * (base["refundFraction"] + D("0.20"))
    summary = {"asOf": INPUTS["asOf"], "currency": INPUTS["currency"], "status": INPUTS["status"],
               "scenarios": scenarios, "cooperativeVolumes": volumes, "platform": platform_rows,
               "additionalMemberRewards": member_rewards,
               "illustrativeCustomerContributionLTV": customer_contribution / ACQUISITION["monthlyCustomerChurn"],
               "illustrativeCustomerCACPaybackMonths": ACQUISITION["customerAcquisitionCost"] / customer_contribution,
               "workingCapitalAt100Jobs": runway}
    (ROOT / "results.json").write_text(json.dumps(serial(summary), indent=2) + "\n")
    write_csv("unit-economics.csv", scenarios)
    write_csv("cooperative-volumes.csv", volumes)
    write_csv("platform-economics.csv", platform_rows)
    write_csv("price-support-sensitivity.csv", sensitivity)
    write_csv("member-reward-sensitivity.csv", member_rewards)
    print(json.dumps(serial(summary), indent=2))


if __name__ == "__main__":
    main()
