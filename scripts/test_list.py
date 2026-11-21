"""Quick local check: can we read a shared Google Maps list?

Usage:
    python scripts/test_list.py "https://maps.app.goo.gl/XXXX"

Standard library only. Mirrors functions/api/list.js so you can verify the
approach from your own machine before deploying.
"""
import http.cookiejar
import json
import re
import secrets
import sys
import urllib.parse
import urllib.request

SHORTLINK_UA = "Mozilla/5.0"
BROWSER_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
CONSENT = "SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg; CONSENT=YES+"


def main(url: str) -> None:
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    req = urllib.request.Request(url, headers={"User-Agent": SHORTLINK_UA, "Cookie": CONSENT})
    final_url = opener.open(req).geturl()
    decoded = urllib.parse.unquote(final_url)
    print("Resolved:", final_url[:160], "...")

    m = re.search(r"!2s(-?[\w-]+)!", decoded) or re.search(r"/placelists/list/(-?[\w-]+)", decoded)
    if not m:
        sys.exit("List id not found in resolved URL.")
    list_id = m.group(1)
    t = re.search(r"token%3D([\w-]+)", final_url) or re.search(r"[?&]token=([\w-]+)", decoded)
    token = t.group(1) if t else None

    page = f"https://www.google.com/maps/placelists/list/{list_id}" + (f"?token={token}" if token else "")
    pb = ("!2e2!3e2!4i500!6m3"
          f"!1s{secrets.token_urlsafe(16)}"
          "!15i204459!28e2"
          f"!13s{urllib.parse.quote(page, safe='')}"
          "!16b1")
    api = f"https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=en&gl=nl&pb={pb}"
    text = opener.open(urllib.request.Request(api, headers={"User-Agent": BROWSER_UA, "Cookie": CONSENT})).read().decode()
    if text.startswith(")]}'"):
        text = text[4:]
    data = json.loads(text)

    title = data[0][4] if len(data[0]) > 4 else None
    raw = data[0][8] or []
    print(f"\nList: {title}  ({len(raw)} places)\n")
    for p in raw:
        info = p[1] if len(p) > 1 and isinstance(p[1], list) else []
        ll = info[5] if len(info) > 5 else None
        lat, lng = (ll[2], ll[3]) if ll and len(ll) >= 4 else (None, None)
        addr = info[4] if len(info) > 4 else ""
        print(f"- {p[2]}  |  {addr}  |  {lat}, {lng}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
