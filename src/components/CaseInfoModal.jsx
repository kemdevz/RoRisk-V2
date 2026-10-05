import { useEffect, useMemo, useState } from "react";
import { ItemCard } from "../Pages/CaseOpen";

const modalScope = { "data-v-fe6ea53c": "" };

function numberFrom(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function chanceValue(item) {
  const chance = Number.parseFloat(String(item?.chance ?? "").replace("%", ""));
  return Number.isFinite(chance)
    ? chance
    : Math.max(0, numberFrom(item?.tickets)) / 1000;
}

function caseIdentifier(box) {
  return box?._id || box?.caseId || box?.case_id || box?.slug || "";
}

function caseAmount(box, currency) {
  if (currency === "coins")
    return numberFrom(box?.coinAmount ?? box?.coin_amount ?? box?.amount);
  return numberFrom(
    box?.rocoinAmount ?? box?.rocoin_amount ?? box?.amount,
  );
}

function formatAmount(value) {
  return Math.max(0, Math.floor(numberFrom(value))).toLocaleString("en-US");
}

export default function CaseInfoModal({ box, currency = "rocoins" }) {
  const [fetched, setFetched] = useState(null);
  const identifier = caseIdentifier(box);
  const details =
    fetched?.identifier === identifier ? { ...box, ...fetched.data } : box;

  useEffect(() => {
    if (!box || (Array.isArray(box.items) && box.items.length)) return undefined;
    if (!identifier) return undefined;
    const controller = new AbortController();
    fetch(
      `/api/cases/${encodeURIComponent(identifier)}?currency=${encodeURIComponent(currency)}`,
      { signal: controller.signal },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const fetched = payload?.case || payload?.box || payload;
        if (fetched && typeof fetched === "object")
          setFetched({ identifier, data: fetched });
      })
      .catch((error) => {
        if (error?.name !== "AbortError") return undefined;
        return undefined;
      });
    return () => controller.abort();
  }, [box, currency, identifier]);

  const items = useMemo(
    () =>
      [...(details?.items || [])].sort(
        (left, right) => chanceValue(left) - chanceValue(right),
      ),
    [details?.items],
  );

  if (!details) return null;

  return (
    <div className="modal-box" {...modalScope}>
      <div className="box-header" {...modalScope}>
        <div className="header-info" {...modalScope}>
          <div className="image-inner" {...modalScope}>
            <div className="inner-background" {...modalScope}>
              <div className="background-content" {...modalScope}>
                <img
                  src={details.imageUrl || details.image || "/default-avatar.png"}
                  alt={details.name || "Case"}
                  decoding="async"
                  {...modalScope}
                />
              </div>
            </div>
          </div>
          <div className="info-text" {...modalScope}>
            <div className="text-name" {...modalScope}>
              {details.name || "Case"}
            </div>
            <div className="text-amount" {...modalScope}>
              <img
                src={currency === "coins" ? "/coin.svg" : "/rocoin.2d3febd5.svg"}
                alt=""
                {...modalScope}
              />
              <div className="amount-value" {...modalScope}>
                <span {...modalScope}>{formatAmount(caseAmount(details, currency))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="title" {...modalScope}>
        Case Items
      </div>
      <div className="box-items" {...modalScope}>
        {items.map((item, index) => (
          <ItemCard
            key={`${item?.index ?? index}-${item?.name || "item"}`}
            item={item}
            items={items}
            currency={currency}
          />
        ))}
      </div>
    </div>
  );
}
