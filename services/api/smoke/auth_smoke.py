"""
End-to-end smoke test for the RDS auth, profile, coach, and deletion paths.

Runs against any API with DATABASE_URL set (local Postgres, SSM-tunnelled
staging RDS, or api.hnnt.app). Creates a throwaway account and deletes it.
Deliberately trips the sign-in rate limit, so run it from a non-shared IP.

    HINTO_API_BASE_URL=http://127.0.0.1:3000 python3 services/api/smoke/auth_smoke.py
"""
import json, urllib.request, urllib.error, sys, uuid
import os
BASE=os.environ.get("HINTO_API_BASE_URL","http://127.0.0.1:3000").rstrip("/")
def call(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method)
    req.add_header("content-type","application/json")
    if token: req.add_header("authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")
def check(label, ok, extra=""):
    print(("PASS " if ok else "FAIL ")+label+(f"  ({extra})" if extra else ""))
    if not ok: sys.exit(1)

email=f"smoke+{uuid.uuid4().hex[:8]}@example.com"; user=f"smoke_{uuid.uuid4().hex[:6]}"
s,b=call("GET","/health"); check("health", s==200 and b["data"]["ok"])
s,b=call("GET","/v1"); check("discovery lists DELETE /v1/me and coach routes", "DELETE /v1/me" in b["data"]["routes"] and "POST /v1/me/conversations" in b["data"]["routes"])

s,b=call("POST","/v1/auth/email/password/sign-up",{"email":email,"password":"Sm0kePass!123","username":user,"displayName":"Smoke Test"})
check("password sign-up", s in (200,201) and b["data"]["accessToken"].startswith("hinto_at_"), f"status {s} {b.get('error')}")
at=b["data"]["accessToken"]; rt=b["data"]["refreshToken"]; me=b["data"]["me"]
check("sign-up returns profile with username", me["profile"]["username"]==user)
check("age is null before gate", me["profile"]["age"] is None)
check("canUseAiCoach false without key", me["capabilities"]["canUseAiCoach"] is False)

s,b=call("POST","/v1/auth/email/password/sign-up",{"email":email,"password":"Sm0kePass!123","username":user+"x","displayName":"Dup"})
check("duplicate sign-up rejected", s==409, f"status {s}")
s,b=call("POST","/v1/auth/email/password/sign-in",{"email":email,"password":"wrong-password"})
check("wrong password rejected", s in (401,400), f"status {s} {b.get('error',{}).get('code')}")
s,b=call("POST","/v1/auth/email/password/sign-in",{"email":email,"password":"Sm0kePass!123"})
check("password sign-in", s==200 and b["data"]["me"]["profile"]["profileId"]==me["profile"]["profileId"], f"status {s}")

s,b=call("GET","/v1/me",token=at); check("GET /v1/me with access token", s==200)
s,b=call("GET","/v1/me",token="hinto_at_bogus"); check("bogus token 401", s==401)
s,b=call("PATCH","/v1/me",{"age":15},token=at); check("age 15 refused", s==403, f"{s} {b.get('error',{}).get('code')}")
s,b=call("PATCH","/v1/me",{"age":24,"bio":"hello"},token=at); check("age 24 accepted and verified", s==200 and b["data"]["profile"]["age"]==24 and b["data"]["profile"]["ageVerified"] is True, f"{s}")

s,b=call("POST","/v1/auth/refresh",{"refreshToken":rt}); check("refresh rotates tokens", s==200 and b["data"]["accessToken"]!=at, f"{s} {b.get('error')}")
at2=b["data"]["accessToken"]; rt2=b["data"]["refreshToken"]
s,b=call("POST","/v1/auth/refresh",{"refreshToken":rt}); check("old refresh token no longer valid", s==401, f"{s}")
s,b=call("GET","/v1/me",token=at2); check("new access token works", s==200)

s,b=call("POST","/v1/me/situationships",{"name":"Alex","emoji":"🔥","category":"dating"},token=at2); check("create situationship", s==201, f"{s} {b.get('error')}")
s,b=call("GET","/v1/me/situationships",token=at2); check("list situationships", s==200 and len(b["data"]["items"] if "items" in b["data"] else b["data"].get("situationships",[]))==1, str(list(b["data"].keys())))

s,b=call("POST","/v1/me/conversations",{"title":"Alex"},token=at2); check("create coach conversation on RDS", s==201, f"{s} {b.get('error')}")
cid=b["data"]["conversation"]["conversationId"]
s,b=call("POST",f"/v1/me/conversations/{cid}/messages",{"content":"Should I text Alex back?"},token=at2)
check("send coach message (no key => configured-notice reply, usage 1/30)", s==201 and b["data"]["assistantMessage"]["isUser"] is False and b["data"]["dailyUsage"]["aiMessagesUsed"]==1, f"{s} {b.get('error')}")
s,b=call("GET",f"/v1/me/conversations/{cid}",token=at2); check("conversation history has 2 messages", s==200 and len(b["data"]["messages"])==2)
s,b=call("POST",f"/v1/me/conversations/{cid}/messages",{"content":"he hit me and I want to die"},token=at2)
check("crisis message gets emergency response", s==201 and ("988" in b["data"]["assistantMessage"]["content"] or "crisis" in b["data"]["assistantMessage"]["content"].lower()), b["data"]["assistantMessage"]["content"][:80] if s==201 else str(b))

s,b=call("POST","/v1/auth/email/otp",{"email":email,"intent":"sign_in"}); check("OTP without SES => 503 email_otp_unavailable", s==503 and b["error"]["code"]=="email_otp_unavailable", f"{s} {b.get('error')}")
s,b=call("POST","/v1/auth/apple/native",{"identityToken":"not-a-jwt"}); check("Apple native rejects garbage token", s in (400,401), f"{s} {b.get('error',{}).get('code')}")
s,b=call("POST","/v1/dev/session",{"username":"x"}); check("dev session hidden when dev auth off", s==404, f"{s}")

for i in range(21):
    s,b=call("POST","/v1/auth/email/password/sign-in",{"email":email,"password":"wrong"})
check("auth rate limit kicks in after 20 attempts", s==429 and b["error"]["code"]=="rate_limited", f"{s}")

s,b=call("DELETE","/v1/me",token=at2); check("DELETE /v1/me", s==200 and b["data"]["deleted"] is True, f"{s} {b.get('error')}")
s,b=call("GET","/v1/me",token=at2); check("token dead after deletion", s==401, f"{s}")
s,b=call("POST","/v1/auth/refresh",{"refreshToken":rt2}); check("refresh dead after deletion", s==401, f"{s}")
print("ALL PASSED")
