#!/bin/sh
# Signed-out access check for the timetable API. Run after a deploy:
#   sh scripts/check-public-api.sh [base-url]
# The public calendar needs /api/overrides and /api/staff; nothing else is open.
B=${1:-https://st.farmasialde.com/timetable}
fail=0
code() { curl -s -o /dev/null -w '%{http_code}' -m 15 "$@"; }
expect() { got=$(code "$@"); [ "$got" = "$want" ] || { echo "FAIL $want != $got: $*"; fail=1; }; }
want=200; expect "$B/api/overrides"; expect "$B/api/staff"
want=401; expect "$B/api/staff/fatimah"; expect "$B/api/leave"
expect -X POST -H 'content-type: application/json' -d '{}' "$B/api/staff"
curl -s -m 15 "$B/api/staff" | grep -qE 'Entitlement|createdAt' && { echo "FAIL signed-out /api/staff leaks entitlements"; fail=1; }
[ $fail = 0 ] && echo "OK public API surface"
exit $fail
