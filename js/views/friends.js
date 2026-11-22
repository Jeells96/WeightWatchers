import { h, icon, sheet, toast, fmt, weightChart } from "../ui.js";
import {
  state, SHARE_FIELDS, sendFriendRequest, acceptRequest, declineRequest,
  cancelOutgoing, setFriendShare, removeFriend, loadFriendView,
} from "../state.js";
import { toggle } from "../foodsearch.js";

export function renderFriends() {
  const wrap = h("div", { class: "view" });
  const d = state.data;

  wrap.append(h("div", { class: "topbar" }, h("span"), h("div", { class: "tb-title" }, "Community"), h("span")));

  // Add friend
  const nameInp = h("input", { class: "f-input", placeholder: "Friend's name", autocapitalize: "words" });
  wrap.append(h("div", { class: "card" },
    h("div", { class: "card-title" }, "Add a friend"),
    h("div", { class: "add-friend-row" },
      nameInp,
      h("button", {
        class: "btn-primary", onClick: async () => {
          const v = nameInp.value.trim();
          if (!v) { toast("Enter a name"); return; }
          const res = await sendFriendRequest(v);
          toast(res.msg);
          if (res.ok) { nameInp.value = ""; window.__rerender(); }
        },
      }, "Send")),
    h("div", { class: "set-hint" }, "They'll need to accept. Then you each choose what to share.")));

  // Incoming requests
  const reqIn = d.requestsIn || [];
  if (reqIn.length) {
    const card = h("div", { class: "card" }, h("div", { class: "card-title" }, `Requests (${reqIn.length})`));
    reqIn.forEach((r) => card.append(h("div", { class: "friend-row" },
      avatar(r.fromName),
      h("div", { class: "friend-name" }, r.fromName),
      h("div", { class: "req-actions" },
        h("button", { class: "mini-btn accept", onClick: async () => { await acceptRequest(r); toast(`You're friends with ${r.fromName}`); window.__rerender(); } }, "Accept"),
        h("button", { class: "mini-btn decline", onClick: async () => { await declineRequest(r); window.__rerender(); } }, "Decline")))));
    wrap.append(card);
  }

  // Friends list
  const friends = d.friends || [];
  const fcard = h("div", { class: "card" }, h("div", { class: "card-title" }, friends.length ? "Your friends" : "No friends yet"));
  if (!friends.length) fcard.append(h("div", { class: "set-hint" }, "Add someone above to compare progress and cheer each other on."));
  friends.forEach((f) => fcard.append(h("div", { class: "friend-row tappable", onClick: () => openFriend(f) },
    avatar(f.name),
    h("div", { class: "friend-name" }, f.name),
    h("button", { class: "share-gear", onClick: (e) => { e.stopPropagation(); openShare(f); } }, icon("settings")),
    icon("chevron", "chev"))));
  wrap.append(fcard);

  // Outgoing (pending) requests
  const reqOut = d.requestsOut || [];
  if (reqOut.length) {
    const card = h("div", { class: "card" }, h("div", { class: "card-title" }, "Pending (sent)"));
    reqOut.forEach((r) => card.append(h("div", { class: "friend-row" },
      avatar(r.toName),
      h("div", { class: "friend-name" }, r.toName),
      h("span", { class: "pending-tag" }, "Pending"),
      h("button", { class: "mini-btn decline", onClick: async () => { await cancelOutgoing(r); window.__rerender(); } }, "Cancel"))));
    wrap.append(card);
  }

  wrap.append(h("div", { style: { height: "12px" } }));
  return wrap;

  function avatar(name) { return h("div", { class: "avatar sm" }, (name || "?").charAt(0).toUpperCase()); }

  // What I share with this friend (checkboxes)
  function openShare(f) {
    const share = { ...(f.share || {}) };
    const body = h("div", { class: "share-body" },
      h("p", { class: "setup-p" }, `Choose what ${f.name} can see. They won't see anything you leave off.`),
      ...SHARE_FIELDS.map((field) => h("label", { class: "share-item" },
        h("span", {}, field.label),
        toggle(!!share[field.key], (on) => { share[field.key] = on; }))),
      h("button", { class: "btn-primary big", onClick: () => { setFriendShare(f.id, share); toast("Sharing updated"); sh.close(); } }, "Save"),
      h("button", { class: "btn-ghost danger", onClick: async () => { await removeFriend(f.id); toast(`Removed ${f.name}`); sh.close(); window.__rerender(); } }, "Remove friend"));
    const sh = sheet(`Share with ${f.name}`, body, { full: true });
  }

  // View what the friend shares with me
  async function openFriend(f) {
    const body = h("div", { class: "friend-view" }, h("div", { class: "gate loading" }, h("div", { class: "spinner" })));
    const sh = sheet(f.name, body, { full: true });
    let v;
    try { v = await loadFriendView(f.id); } catch { v = null; }
    body.replaceChildren();
    if (!v) { body.append(h("div", { class: "empty" }, "Couldn't load their data right now.")); return; }
    const sharedAny = Object.values(v.share || {}).some(Boolean);
    if (!sharedAny) { body.append(h("div", { class: "empty" }, `${v.name} hasn't shared anything with you yet.`)); return; }

    if (v.share.budget) {
      body.append(h("div", { class: "card total-card" },
        h("div", {}, h("div", { class: "total-num" }, String(v.usedToday ?? 0)), h("div", { class: "total-lbl" }, "Points eaten today")),
        h("div", { class: "total-right" }, h("div", { class: "total-num small " + ((v.remaining ?? 0) < 0 ? "over" : "") }, String(v.remaining ?? 0)), h("div", { class: "total-lbl" }, `of ${v.dailyBudget ?? "–"} left`))));
    }
    if (v.share.weight) {
      const lost = v.startWeight != null && v.currentWeight != null ? +(v.startWeight - v.currentWeight).toFixed(1) : null;
      body.append(h("div", { class: "card weight-hero" },
        h("div", { class: "wh-current" },
          h("div", { class: "wh-num" }, v.currentWeight != null ? fmt(v.currentWeight, 1) : "–"),
          h("div", { class: "wh-unit" }, v.unit), h("div", { class: "wh-cap" }, "Current")),
        h("div", { class: "wh-side" },
          h("div", { class: "wh-mini" }, h("div", { class: "wh-mini-num" }, v.goalWeight != null ? fmt(v.goalWeight, 1) : "–"), h("div", { class: "wh-mini-lbl" }, `Goal (${v.unit})`)),
          lost != null ? h("div", { class: "wh-mini" }, h("div", { class: "wh-mini-num" }, `${lost >= 0 ? "−" : "+"}${fmt(Math.abs(lost), 1)}`), h("div", { class: "wh-mini-lbl" }, `Lost (${v.unit})`)) : null)));
    }
    if (v.share.weighIns && v.weighIns?.length) {
      body.append(h("div", { class: "card" }, h("div", { class: "card-title" }, "Trend"), weightChart(v.weighIns, { goal: v.goalWeight })));
    }
    if (v.share.activity) {
      body.append(h("div", { class: "card activity-hero" }, icon("flame", "flame-ico"),
        h("div", {}, h("div", { class: "ah-num" }, String(v.activityToday ?? 0)), h("div", { class: "ah-lbl" }, "activity Points today"))));
    }
    if (v.share.water) {
      body.append(h("div", { class: "card water-card" }, h("div", { class: "card-title-row" }, h("div", { class: "card-title" }, "Water"), h("div", { class: "water-count" }, `${v.water ?? 0} / 8 cups`))));
    }
    if (v.share.points && v.meals) {
      const mcard = h("div", { class: "card meals-card" }, h("div", { class: "card-title" }, "Today's food"));
      [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snack", "Snacks"]].forEach(([k, lbl]) => {
        const items = v.meals[k] || [];
        if (!items.length) return;
        mcard.append(h("div", { class: "meal-head" }, h("div", { class: "meal-name" }, lbl)));
        items.forEach((it) => mcard.append(h("div", { class: "logged-item" },
          h("div", { class: "li-main" }, h("div", { class: "li-name" }, it.name)),
          h("div", { class: "li-pts" + (it.points === 0 ? " zero" : "") }, String(it.points * (it.qty || 1))))));
      });
      body.append(mcard);
    }
    body.append(h("div", { style: { height: "16px" } }));
  }
}
