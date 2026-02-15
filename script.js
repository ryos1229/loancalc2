/**
 * 住宅ローン計算ロジック
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const inputs = {
        amount: document.getElementById('loan-amount'),
        amountRange: document.getElementById('loan-amount-range'),
        years: document.getElementById('loan-years'),
        yearsRange: document.getElementById('loan-years-range'),
        rate: document.getElementById('interest-rate'),
        rateRange: document.getElementById('interest-rate-range'),
        bonus: document.getElementById('bonus-payment'),
        bonusRange: document.getElementById('bonus-payment-range')
    };

    const typeRadios = document.getElementsByName('repayment-type');

    const outputs = {
        monthly: document.getElementById('monthly-payment'),
        monthlyLabel: document.getElementById('monthly-label'),
        monthlyWithBonus: document.getElementById('monthly-with-bonus'),
        bonusCombinedContainer: document.getElementById('bonus-combined-result'),
        mainResultGrid: document.querySelector('.main-result'),
        bonusTotal: document.getElementById('bonus-monthly-total'),
        total: document.getElementById('total-payment'),
        interest: document.getElementById('total-interest')
    };

    /**
     * 数値を3桁区切りの文字列に変換
     */
    const formatNumber = (num) => {
        return Math.round(num).toLocaleString('ja-JP');
    };

    /**
     * 住宅ローンの計算
     */
    const calculateLoan = () => {
        // 入力値の取得
        const P_total = parseFloat(inputs.amount.value) * 10000; // 万円 -> 円
        const years = parseFloat(inputs.years.value);
        const rateYear = parseFloat(inputs.rate.value) / 100; // % -> 小数
        const B = parseFloat(inputs.bonus.value) * 10000; // 1回あたりのボーナス加算額 (円)

        let repaymentType = 'equal-total';
        for (const radio of typeRadios) {
            if (radio.checked) {
                repaymentType = radio.value;
                break;
            }
        }

        if (isNaN(P_total) || isNaN(years) || isNaN(rateYear) || years <= 0) return;

        const n = years * 12; // 総返済月数
        const r = rateYear / 12; // 月利
        const nBonus = years * 2; // ボーナス返済回数

        // 1. ボーナスを一切使わない場合の計算 (月々均等)
        let monthlyOnlyPayment = 0;
        if (repaymentType === 'equal-total') {
            monthlyOnlyPayment = (rateYear === 0) ? (P_total / n) : (P_total * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
        } else {
            monthlyOnlyPayment = (P_total / n) + (P_total * r); // 初回
        }

        // 2. ボーナス併用の場合の計算
        let monthlyPaymentDisplay = 0;
        let totalPayment = 0;

        if (repaymentType === 'equal-total') {
            // --- 元利均等返済 ---
            outputs.monthlyLabel.innerText = "月々均等支払額";

            if (rateYear === 0) {
                const pBonus = B * nBonus;
                monthlyPaymentDisplay = (P_total - pBonus) / n;
                totalPayment = P_total;
            } else {
                const r6 = r * 6;
                let pBonus = B * (Math.pow(1 + r6, nBonus) - 1) / (r6 * Math.pow(1 + r6, nBonus));
                if (pBonus > P_total) pBonus = P_total;

                const pMonthly = P_total - pBonus;
                monthlyPaymentDisplay = pMonthly * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                totalPayment = (monthlyPaymentDisplay * n) + (B * nBonus);
            }
        } else {
            // --- 元金均等返済 ---
            outputs.monthlyLabel.innerText = "月々初回支払額";

            const pBonusTotal = B * nBonus;
            const pMonthlyTotal = P_total - pBonusTotal;

            if (pMonthlyTotal < 0) {
                monthlyPaymentDisplay = 0;
                totalPayment = P_total + calculateTotalInterestEqualPrincipal(P_total, nBonus, r * 6);
            } else {
                const principalPerMonth = pMonthlyTotal / n;
                const firstInterest = P_total * r;
                monthlyPaymentDisplay = principalPerMonth + firstInterest;

                const monthlyInterestTotal = pMonthlyTotal * r * (n + 1) / 2;
                const bonusInterestTotal = pBonusTotal * (r * 6) * (nBonus + 1) / 2;
                totalPayment = P_total + monthlyInterestTotal + bonusInterestTotal;
            }
        }

        const totalInterest = totalPayment - P_total;

        // 表示の切り替え (ボーナスがある場合のみ併用分を表示)
        if (B > 0) {
            outputs.bonusCombinedContainer.classList.remove('hidden');
            outputs.mainResultGrid.classList.remove('hide-bonus');
            animateValue(outputs.monthlyWithBonus, monthlyPaymentDisplay);
            animateValue(outputs.monthly, monthlyOnlyPayment);
        } else {
            outputs.bonusCombinedContainer.classList.add('hidden');
            outputs.mainResultGrid.classList.add('hide-bonus');
            animateValue(outputs.monthly, monthlyOnlyPayment);
            // ボーナスがない場合はシンプルなラベルに戻す
            outputs.monthlyLabel.innerText = (repaymentType === 'equal-total') ? "月々均等支払額" : "月々初回支払額";
        }

        // 結果の表示
        animateValue(outputs.bonusTotal, B);
        animateValue(outputs.total, totalPayment);
        animateValue(outputs.interest, totalInterest);

        // --- 返済予定表の生成 ---
        const freq = document.querySelector('input[name="schedule-freq"]:checked').value;
        generateSchedule(P_total, years, rateYear, B, repaymentType, freq);

        updateRangeBackground();
    };

    /**
     * 返済予定表の生成
     */
    function generateSchedule(P_total, years, rateYear, bonusPerTime, type, freq) {
        const tbody = document.getElementById('schedule-body');
        const desc = document.getElementById('schedule-desc');
        const countHeader = document.querySelector('#payment-schedule th:first-child');

        tbody.innerHTML = '';

        if (freq === 'yearly') {
            desc.innerText = '1年ごとの返済推移を確認できます';
            countHeader.innerText = '年数';
        } else {
            desc.innerText = '月ごとの返済明細を確認できます';
            countHeader.innerText = '回数';
        }

        const n = years * 12;
        const r = rateYear / 12;
        let balance = P_total;

        const nBonus = years * 2;
        const pBonusTotal = bonusPerTime * nBonus;
        const pMonthlyTotal = P_total - pBonusTotal;
        const principalMonthly = Math.max(0, pMonthlyTotal / n);

        let monthlyPaymentTotal = 0;
        if (type === 'equal-total') {
            const r6 = r * 6;
            let pBonus = (rateYear === 0) ? (bonusPerTime * nBonus) : (bonusPerTime * (Math.pow(1 + r6, nBonus) - 1) / (r6 * Math.pow(1 + r6, nBonus)));
            if (pBonus > P_total) pBonus = P_total;
            const pMonthly = P_total - pBonus;
            monthlyPaymentTotal = (rateYear === 0) ? (pMonthly / n) : (pMonthly * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
        }

        let fragment = document.createDocumentFragment();

        // 年間集計用の変数
        let yearlyTotal = 0;
        let yearlyPrincipal = 0;
        let yearlyInterest = 0;
        let yearlyBonus = 0;

        for (let i = 1; i <= n; i++) {
            let interest = balance * r;
            let principal = 0;
            let bonusAdd = 0;
            let total = 0;

            if (type === 'equal-total') {
                principal = monthlyPaymentTotal - interest;
                total = monthlyPaymentTotal;
            } else {
                principal = principalMonthly;
                total = principal + interest;
            }

            if (i % 6 === 0) {
                bonusAdd = bonusPerTime;
                if (bonusAdd > balance - principal) {
                    bonusAdd = Math.max(0, balance - principal);
                }
            }

            balance -= (principal + bonusAdd);
            if (balance < 0) balance = 0;

            // 集計
            yearlyTotal += total;
            yearlyPrincipal += principal;
            yearlyInterest += interest;
            yearlyBonus += bonusAdd;

            // 表示処理
            if (freq === 'monthly') {
                const tr = document.createElement('tr');
                if (i % 12 === 0) tr.classList.add('year-end');

                // 1月目、または12ヶ月ごとに年度ラベルを表示
                let yearLabel = "";
                if (i === 1 || (i - 1) % 12 === 0) {
                    yearLabel = `<div class="year-badge">${Math.floor((i - 1) / 12) + 1}年</div>`;
                }

                tr.innerHTML = `
                    <td>${yearLabel}${i}</td>
                    <td>${formatNumber(total)}</td>
                    <td>${formatNumber(principal)}</td>
                    <td>${formatNumber(interest)}</td>
                    <td>${bonusAdd > 0 ? formatNumber(bonusAdd) : '-'}</td>
                    <td>${formatNumber(balance)}</td>
                `;
                fragment.appendChild(tr);
            } else if (i % 12 === 0 || balance <= 0) {
                // 12ヶ月ごと、または最終回に表示
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${Math.ceil(i / 12)}年目</td>
                    <td>${formatNumber(yearlyTotal)}</td>
                    <td>${formatNumber(yearlyPrincipal)}</td>
                    <td>${formatNumber(yearlyInterest)}</td>
                    <td>${yearlyBonus > 0 ? formatNumber(yearlyBonus) : '-'}</td>
                    <td>${formatNumber(balance)}</td>
                `;
                fragment.appendChild(tr);

                // 集計リセット
                yearlyTotal = 0;
                yearlyPrincipal = 0;
                yearlyInterest = 0;
                yearlyBonus = 0;
            }

            if (balance <= 0) break;
        }

        tbody.appendChild(fragment);
    }

    /**
     * 元金均等返済の総利息を計算するヘルパー
     */
    function calculateTotalInterestEqualPrincipal(P, n, r) {
        if (n <= 0) return 0;
        return P * r * (n + 1) / 2;
    }

    /**
     * 数値をアニメーションさせながら表示
     */
    function animateValue(element, target) {
        const startValue = parseInt(element.innerText.replace(/,/g, '')) || 0;
        const duration = 400;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOutQuad = progress * (2 - progress);
            const current = startValue + (target - startValue) * easeOutQuad;

            element.innerText = formatNumber(current);

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        requestAnimationFrame(update);
    }

    /**
     * レンジ入力の背景を更新
     */
    function updateRangeBackground() {
        const rangeInputs = document.querySelectorAll('input[type="range"]');
        rangeInputs.forEach(input => {
            const min = parseFloat(input.min) || 0;
            const max = parseFloat(input.max) || 100;
            const val = parseFloat(input.value);
            const percentage = (val - min) * 100 / (max - min);
            input.style.backgroundSize = percentage + '% 100%';
        });
    }

    // イベントリスナーの設定
    const setupEventListeners = () => {
        const sync = (inputEl, rangeEl) => {
            inputEl.addEventListener('input', () => {
                rangeEl.value = inputEl.value;
                calculateLoan();
            });
            rangeEl.addEventListener('input', () => {
                inputEl.value = rangeEl.value;
                calculateLoan();
            });
        };

        sync(inputs.amount, inputs.amountRange);
        sync(inputs.years, inputs.yearsRange);
        sync(inputs.rate, inputs.rateRange);
        sync(inputs.bonus, inputs.bonusRange);

        // 返済方式の切り替え
        for (const radio of typeRadios) {
            radio.addEventListener('change', calculateLoan);
        }

        // 表示頻度の切り替え
        const freqRadios = document.getElementsByName('schedule-freq');
        for (const radio of freqRadios) {
            radio.addEventListener('change', calculateLoan);
        }
        // 印刷ボタン
        const btnPrint = document.getElementById('btn-print');
        btnPrint.addEventListener('click', () => {
            window.print();
        });
    };

    setupEventListeners();
    calculateLoan();
});
