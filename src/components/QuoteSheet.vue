<script setup lang="ts">
import { computed, ref } from 'vue';
import { ACCESS, CLASSES, DEFAULT_SETTINGS, SLOPES, type Job, type Quote, type Settings } from '../lib/pricing';
import { fmt, fmtM2, fmtRs, toUnits } from '../lib/units';

const props = defineProps<{ area: number; job: Job; settings: Settings; quote: Quote }>();
defineEmits<{ close: [] }>();

const showRates = ref(false);
const mixTotal = computed(() => Object.values(props.job.mix).reduce((a, b) => a + Math.max(0, b), 0));
const share = (v: number) => (mixTotal.value > 0 ? Math.round((Math.max(0, v) / mixTotal.value) * 100) : 0);

function resetRates() {
  if (confirm('Put all rates back to the starting guesses?')) Object.assign(props.settings, structuredClone(DEFAULT_SETTINGS));
}
</script>

<template>
  <div class="sheet-backdrop" @click.self="$emit('close')">
    <section class="sheet">
      <header>
        <h2>Clearing quote</h2>
        <button class="close" @click="$emit('close')">Close</button>
      </header>

      <p class="muted">{{ fmtM2(area) }} · {{ fmt(toUnits(area).perches, 1) }} perches · {{ fmt(toUnits(area).arpents, 2) }} arpents</p>

      <div class="result">
        <div>
          <span class="muted">Likely</span>
          <strong>{{ fmtRs(quote.mid.price) }}</strong>
          <span>{{ fmt(quote.mid.hours, 1) }} h · {{ fmt(quote.mid.days, 1) }} day(s)</span>
        </div>
        <div class="range">
          <span>Range {{ fmtRs(quote.low.price) }} – {{ fmtRs(quote.high.price) }}</span>
          <span>{{ fmt(quote.low.hours, 1) }}–{{ fmt(quote.high.hours, 1) }} h</span>
        </div>
        <p v-if="quote.minChargeApplies" class="muted">Minimum charge applies.</p>
        <p v-for="w in quote.warnings" :key="w" class="warn">{{ w }}</p>
      </div>

      <h3>What is on the plot?</h3>
      <label v-for="c in CLASSES" :key="c.id" class="mix">
        <span>{{ c.label }} <small class="muted">{{ c.hint }}</small></span>
        <input v-model.number="job.mix[c.id]" type="range" min="0" max="100" step="5" />
        <output>{{ share(job.mix[c.id]) }}%</output>
      </label>
      <label class="check"><input v-model="job.levelling" type="checkbox" /> Level the ground after clearing</label>

      <h3>Site</h3>
      <div class="chips">
        <span class="label">Slope</span>
        <button v-for="s in SLOPES" :key="s.id" :class="{ on: job.slope === s.id }" @click="job.slope = s.id">{{ s.label }}</button>
      </div>
      <div class="chips">
        <span class="label">Access</span>
        <button v-for="a in ACCESS" :key="a.id" :class="{ on: job.access === a.id }" @click="job.access = a.id">{{ a.label }}</button>
      </div>
      <label class="check"><input v-model="job.wet" type="checkbox" /> Wet or soft ground</label>
      <label class="check"><input v-model="job.loadOut" type="checkbox" /> Load debris onto lorries (instead of piling on site)</label>
      <label class="field">Distance from base <input v-model.number="job.distanceKm" type="number" min="0" inputmode="decimal" /> km</label>
      <label class="check"><input v-model="job.vat" type="checkbox" /> Add VAT ({{ settings.vatPct }}%)</label>
      <p class="muted">Time multiplier ×{{ fmt(quote.factor, 2) }} · travel {{ fmtRs(quote.travel) }}</p>

      <h3>
        <button class="link" @click="showRates = !showRates">{{ showRates ? '▾' : '▸' }} Rates</button>
      </h3>
      <div v-if="showRates" class="rates">
        <p class="muted">
          Starting guesses from research, not Pentaforce's own figures. Change them to match real jobs; they are kept on
          this phone.
        </p>
        <label class="field">Rs per machine hour <input v-model.number="settings.ratePerHour" type="number" inputmode="numeric" /></label>
        <label class="field">Minimum charge Rs <input v-model.number="settings.minCharge" type="number" inputmode="numeric" /></label>
        <label class="field">Working hours per day <input v-model.number="settings.productiveHoursPerDay" type="number" inputmode="decimal" /></label>
        <label class="field">Travel Rs <input v-model.number="settings.travelFixed" type="number" inputmode="numeric" /> + Rs
          <input v-model.number="settings.travelPerKm" type="number" inputmode="numeric" /> / km beyond
          <input v-model.number="settings.travelFreeKm" type="number" inputmode="numeric" /> km</label>
        <label class="field">Contingency % <input v-model.number="settings.contingencyPct" type="number" inputmode="numeric" /></label>
        <table>
          <thead>
            <tr><th>Hours per arpent</th><th>Low</th><th>Likely</th><th>High</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in CLASSES" :key="c.id">
              <td>{{ c.label }}</td>
              <td><input v-model.number="settings.rates[c.id].low" type="number" inputmode="decimal" /></td>
              <td><input v-model.number="settings.rates[c.id].mid" type="number" inputmode="decimal" /></td>
              <td><input v-model.number="settings.rates[c.id].high" type="number" inputmode="decimal" /></td>
            </tr>
            <tr>
              <td>Levelling</td>
              <td><input v-model.number="settings.levelling.low" type="number" inputmode="decimal" /></td>
              <td><input v-model.number="settings.levelling.mid" type="number" inputmode="decimal" /></td>
              <td><input v-model.number="settings.levelling.high" type="number" inputmode="decimal" /></td>
            </tr>
          </tbody>
        </table>
        <button class="link" @click="resetRates">Reset to starting guesses</button>
      </div>
    </section>
  </div>
</template>
