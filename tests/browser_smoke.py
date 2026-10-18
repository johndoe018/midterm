"""End-to-end checks. Start npm run dev, then run: python3 tests/browser_smoke.py.

Requires the Python Playwright package and Chromium (or Playwright's browser).
BASE_URL can point at the deployed Pages site or /midterm/ subpath.
"""
import json
import os
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:4173/midterm/")
KEY = "memo.ai-midterm.v1"
ROOT = Path(__file__).resolve().parents[1]
BANK = json.loads((ROOT / "public/bank.json").read_text())
ANSWERS = {q["id"]: q.get("answer") for q in BANK["questions"]}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=shutil.which("chromium"), args=["--no-sandbox"])
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("dialog", lambda d: d.accept())

    def go(route):
        page.goto(BASE + "#" + route)
        page.wait_for_selector("#main")

    def read_state():
        return page.evaluate("key => JSON.parse(localStorage.getItem(key))", KEY)

    def setup(kind, count="5"):
        go(kind)
        if page.locator('[data-action="new-session"]').count():
            page.locator('[data-action="new-session"]').click()
        page.locator('[name="count"]').select_option(count)
        page.locator('[name="random"]').uncheck()
        page.locator('#start-form button[type="submit"]').click()

    go("home")
    expect(page.locator(".topic-card")).to_have_count(7)
    for selector in ['link[rel="icon"]', 'link[rel="manifest"]', '.footer a']:
        asset_url = page.locator(selector).evaluate("el => el.href")
        response = context.request.get(asset_url)
        assert response.status == 200, (asset_url, response.status)
    bank_response = context.request.get(BASE + "public/bank.json")
    assert bank_response.status == 200
    assert len(bank_response.json()["questions"]) == 329
    legacy_bank = context.request.get(BASE + "bank.json")
    assert legacy_bank.status == 200
    assert len(legacy_bank.json()["questions"]) == 329
    page.screenshot(path="/tmp/memo-desktop.png", full_page=True)
    print("PASS: dashboard, 7 sections, repository subpath assets")

    setup("practice")
    for i in range(5):
        qid = page.locator(".question-id").inner_text()
        answer = ANSWERS[qid] if i != 1 else (ANSWERS[qid] + 1) % 4
        page.locator(f'[data-action="answer"][data-answer="{answer}"]').click()
        expect(page.locator(".answer-feedback")).to_be_visible()
        expect(page.locator(".option.correct")).to_have_count(1)
        page.locator('[data-action="next"]').click()
    expect(page.locator(".result-ring strong")).to_have_text("80%")
    assert len(read_state()["progress"]) == 5
    assert read_state()["progress"]["Q002"]["lastWrong"]
    page.reload()
    expect(page.locator(".result-ring strong")).to_have_text("80%")
    page.locator('[data-action="retry-wrong"]').click()
    expect(page.locator(".question-id")).to_have_text("Q002")
    page.locator(f'[data-action="answer"][data-answer="{ANSWERS["Q002"]}"]').click()
    page.locator('[data-action="next"]').click()
    assert not read_state()["progress"]["Q002"]["lastWrong"]
    print("PASS: immediate feedback, scoring, persistence, retry mistakes")

    setup("exam")
    before = sum(x["attempts"] for x in read_state()["progress"].values())
    for i in range(4):
        qid = page.locator(".question-id").inner_text()
        page.locator(f'[data-action="answer"][data-answer="{ANSWERS[qid]}"]').click()
        expect(page.locator(".answer-feedback")).to_have_count(0)
        expect(page.locator(".option.correct")).to_have_count(0)
        page.locator('[data-action="next"]').click()
    saved_deadline = read_state()["session"]["deadline"]
    page.reload()
    expect(page.locator(".question-id")).to_have_text("Q005")
    assert read_state()["session"]["deadline"] == saved_deadline
    assert sum(x["attempts"] for x in read_state()["progress"].values()) == before
    page.locator('[data-action="finish-exam"]').click()
    expect(page.locator("#modal")).to_contain_text("Без ответа: 1")
    page.locator('[data-action="confirm-finish"]').click()
    expect(page.locator(".result-ring strong")).to_have_text("80%")
    assert sum(x["attempts"] for x in read_state()["progress"].values()) == before + 5
    assert read_state()["history"][-1]["kind"] == "exam"
    print("PASS: exam hides answers, timer persists, skips count as incorrect")

    page.locator('[data-action="new-session"]').click()
    page.locator('[name="count"]').select_option("5")
    page.locator('#start-form button[type="submit"]').click()
    page.evaluate("""key => { const s=JSON.parse(localStorage.getItem(key)); s.session.startedAt=Date.now()-120000; s.session.deadline=Date.now()-1000; localStorage.setItem(key,JSON.stringify(s)); }""", KEY)
    page.reload()
    expect(page.locator(".result-ring strong")).to_have_text("0%")
    assert read_state()["session"]["finished"]
    print("PASS: expired exam completes after returning to the tab")

    setup("cards")
    for i in range(5):
        page.keyboard.press("Space")
        expect(page.locator(".card-back")).to_be_visible()
        page.keyboard.press("3" if i else "1")
    expect(page.locator(".result-ring strong")).to_have_text("80%")
    print("PASS: flashcard recall, reveal and keyboard rating")

    setup("essays")
    for i in range(5):
        text = f"My explanation {i}: AI creates drafts that require independent verification."
        page.locator("#essay-answer").fill(text)
        if i == 0:
            page.reload()
            expect(page.locator("#essay-answer")).to_have_value(text)
        page.locator('[data-action="flip"]').click()
        expect(page.locator(".model-answer")).to_be_visible()
        expect(page.locator(".rubric-item")).to_have_count(5)
        for j in range(4):
            page.locator(f'[data-rubric="{j}"]').check()
        expect(page.locator("#rubric-score")).to_have_text("4 / 5")
        page.locator('[data-action="grade-essay"]').click()
    expect(page.locator(".result-ring strong")).to_have_text("100%")
    assert len(read_state()["essays"]) == 5
    print("PASS: essays autosave, model responses, 5-point self-assessment")

    go("bank")
    expect(page.locator(".bank-row")).to_have_count(329)
    page.locator("#bank-search").fill("Q256")
    expect(page.locator(".bank-row")).to_have_count(1)
    page.locator('[data-action="bookmark"]').click()
    page.locator(".bank-question").click()
    expect(page.locator(".answer-details")).to_be_visible()
    page.locator(".answer-details summary").click()
    expect(page.locator(".answer-details .correct-text")).to_be_visible()
    page.locator('[data-action="close-modal"]').click()
    page.locator("#bank-search").fill("")
    page.locator("#filter-status").select_option("favorites")
    expect(page.locator(".bank-row")).to_have_count(1)
    print("PASS: all questions, search, answer reference and favorites")

    page.locator('[data-action="settings"]').click()
    page.locator("#daily-goal").fill("30")
    page.locator('[data-action="save-goal"]').click()
    assert read_state()["goal"] == 30
    with page.expect_download() as download_info:
        page.locator('#modal [data-action="export"]').click()
    download = download_info.value
    export_path = "/tmp/memo-test-export.json"
    download.save_as(export_path)
    exported = json.loads(Path(export_path).read_text())
    assert exported["goal"] == 30
    page.locator("#import-file").set_input_files(export_path)
    expect(page.locator("#modal")).not_to_be_visible()
    assert read_state()["goal"] == 30
    page.locator('[data-action="theme"]').click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    page.reload()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    page.locator('[data-action="theme"]').click()
    print("PASS: goal settings, export/import, persistent theme")

    go("progress")
    expect(page.locator(".history-row")).to_have_count(6)
    expect(page.locator(".activity-cell")).to_have_count(28)

    mobile = context.new_page()
    mobile.set_viewport_size({"width":390,"height":844})
    mobile.goto(BASE)
    expect(mobile.locator(".hero")).to_be_visible()
    mobile.wait_for_timeout(300)
    assert not mobile.evaluate("document.documentElement.scrollWidth > innerWidth")
    mobile.screenshot(path="/tmp/memo-mobile.png", full_page=True)
    mobile.locator('[data-action="menu"]').click()
    mobile.locator('nav a[href="#bank"]').click()
    expect(mobile.locator("body")).not_to_have_class("menu-open")
    expect(mobile.locator("#bank-search")).to_be_visible()
    assert not mobile.evaluate("document.documentElement.scrollWidth > innerWidth")
    print("PASS: mobile layout, no horizontal overflow, working menu")

    go("home")
    page.evaluate("navigator.serviceWorker.ready")
    page.wait_for_function("navigator.serviceWorker.controller !== null")
    context.set_offline(True)
    page.reload()
    expect(page.locator(".hero")).to_be_visible()
    go("bank")
    expect(page.locator(".bank-row")).to_have_count(329)
    context.set_offline(False)
    print("PASS: offline reload and complete question bank from service worker")

    # A JSON fetch failure must never prevent the current application loading.
    # This also catches accidental regressions to the original bootstrap path.
    json_blocked_context = browser.new_context(service_workers="block")
    json_blocked = json_blocked_context.new_page()
    blocked_requests = []
    def block_json(route):
        blocked_requests.append(route.request.url)
        route.abort()
    json_blocked.route("**/*.json", block_json)
    json_blocked.goto(BASE)
    expect(json_blocked.locator(".hero")).to_be_visible()
    json_blocked.goto(BASE + "#bank")
    expect(json_blocked.locator(".bank-row")).to_have_count(329)
    assert not blocked_requests, blocked_requests
    json_blocked_context.close()
    print("PASS: question bank loads without JSON requests; legacy bank URL still supported")
    assert not errors, errors
    print("ALL BROWSER CHECKS PASSED; no JavaScript runtime errors.")
    browser.close()
