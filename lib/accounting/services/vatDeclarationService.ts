/**
 * VAT Declaration Service (Momsdeklaration)
 * 
 * Genererar komplett momsdeklaration för Skatteverket enligt deras specifikation.
 * Stödjer alla boxar i momsdeklarationen (SKV 4700).
 * 
 * Rutor i momsdeklarationen:
 * - 05-08: Försäljning (utgående moms)
 * - 10-12: Utgående moms
 * - 20-24: Inköp (ingående moms)
 * - 30-39: Övriga uppgifter
 * - 48-50: Summering
 */

import { FortnoxClient, getFortnoxClient } from '../../fortnox/client';

// ============ Types ============

export interface VATDeclarationBox {
  box: string;
  label: string;
  value: number;
  description: string;
}

export interface VATDeclaration {
  // Metadata
  id: string;
  companyId: string;
  organisationNumber: string;
  companyName: string;
  
  // Period
  period: {
    year: number;
    month?: number;          // För månadsredovisning
    quarter?: number;        // För kvartalsredovisning
    type: 'monthly' | 'quarterly' | 'yearly';
    startDate: string;
    endDate: string;
    label: string;           // "Januari 2024" eller "Q1 2024"
  };
  
  // Försäljning och utgående moms (Ruta 05-12)
  sales: {
    // Momspliktig försäljning
    box05: number;  // Momspliktig försäljning som inte ingår i 06-08
    box06: number;  // Momspliktiga uttag
    box07: number;  // Beskattningsunderlag vid vinstmarginalbeskattning
    box08: number;  // Hyresinkomster vid frivillig skattskyldighet
    
    // Utgående moms
    box10: number;  // Utgående moms 25%
    box11: number;  // Utgående moms 12%
    box12: number;  // Utgående moms 6%
  };
  
  // Inköp och ingående moms (Ruta 20-24)
  purchases: {
    box20: number;  // Inköp av varor från annat EU-land
    box21: number;  // Inköp av tjänster från annat EU-land
    box22: number;  // Inköp av varor i Sverige som köparen är skattskyldig för
    box23: number;  // Inköp av tjänster i Sverige som köparen är skattskyldig för
    box24: number;  // Beskattningsunderlag för import
  };
  
  // Momsfri omsättning (Ruta 35-42)
  taxFree: {
    box35: number;  // Försäljning av varor till annat EU-land
    box36: number;  // Försäljning av varor utanför EU
    box37: number;  // Mellanman vid trepartshandel
    box38: number;  // Försäljning av tjänster till annat EU-land
    box39: number;  // Övrig omsättning utanför Sverige
    box40: number;  // Försäljning där köparen är skattskyldig i Sverige
    box41: number;  // Försäljning av investeringsguld
    box42: number;  // Övrig momsfri omsättning
  };
  
  // Ingående moms att dra av (Ruta 48-50)
  summary: {
    box48: number;  // Ingående moms att dra av
    box49: number;  // Moms att betala (utgående moms)
    box50: number;  // Moms att betala eller få tillbaka
  };
  
  // Beräknade värden
  calculated: {
    totalOutputVAT: number;     // Total utgående moms (10+11+12)
    totalInputVAT: number;      // Total ingående moms (48)
    netVAT: number;             // Att betala/få tillbaka (50)
    taxableBase: number;        // Totalt beskattningsunderlag
  };
  
  // Detaljerade poster
  details: {
    salesItems: VATDetailItem[];
    purchaseItems: VATDetailItem[];
    euPurchaseItems: VATDetailItem[];
    euSalesItems: VATDetailItem[];
  };
  
  // Status och validering
  status: 'draft' | 'validated' | 'submitted' | 'acknowledged';
  validationWarnings: string[];
  validationErrors: string[];
  
  // Tidsstämplar
  generatedAt: string;
  submittedAt?: string;
  acknowledgedAt?: string;
}

export interface VATDetailItem {
  date: string;
  supplier?: string;
  customer?: string;
  invoiceNumber?: string;
  description: string;
  netAmount: number;
  vatAmount: number;
  vatRate: number;
  vatAccount: string;
  type: 'sale' | 'purchase' | 'eu_purchase' | 'eu_sale' | 'import' | 'export';
  country?: string;
}

export interface VATDeclarationSummary {
  period: string;
  outputVAT: number;
  inputVAT: number;
  netVAT: number;
  status: string;
  documentCount: number;
}

// ============ Service ============

class VATDeclarationService {
  private fortnoxClient: FortnoxClient | null = null;
  
  // In-memory store för declarations
  private declarations = new Map<string, VATDeclaration>();
  
  /**
   * Initierar Fortnox-klient
   */
  async init(companyId: string): Promise<void> {
    try {
      this.fortnoxClient = await getFortnoxClient(companyId);
    } catch (error) {
      console.log('[VATDeclaration] Fortnox client not available, using mock data');
    }
  }
  
  /**
   * Generera momsdeklaration för en period
   */
  async generateDeclaration(
    companyId: string,
    year: number,
    month?: number,
    quarter?: number
  ): Promise<VATDeclaration> {
    await this.init(companyId);
    
    // Bestäm period
    const period = this.calculatePeriod(year, month, quarter);
    
    // Hämta data från Fortnox eller generera mock
    const vouchers = await this.getVouchersForPeriod(companyId, period.startDate, period.endDate);
    
    // Beräkna momsbelopp per kategori
    const salesData = this.calculateSalesVAT(vouchers);
    const purchaseData = this.calculatePurchaseVAT(vouchers);
    const euData = this.calculateEUVAT(vouchers);
    const taxFreeData = this.calculateTaxFreeVAT(vouchers);
    
    // Beräkna summor
    const totalOutputVAT = salesData.box10 + salesData.box11 + salesData.box12;
    const totalInputVAT = purchaseData.inputVAT + euData.euInputVAT;
    const netVAT = totalOutputVAT - totalInputVAT;
    
    // Validera
    const { warnings, errors } = this.validateDeclaration({
      sales: salesData,
      purchases: purchaseData,
      euData,
      taxFreeData,
      totalOutputVAT,
      totalInputVAT,
      netVAT,
    });
    
    const declaration: VATDeclaration = {
      id: `vat-${companyId}-${period.label.replace(/\s/g, '-')}`,
      companyId,
      organisationNumber: '556123-4567', // Skulle hämtas från företagsinställningar
      companyName: 'Ditt Bolag AB',
      
      period,
      
      sales: {
        box05: salesData.box05,
        box06: 0,
        box07: 0,
        box08: 0,
        box10: salesData.box10,
        box11: salesData.box11,
        box12: salesData.box12,
      },
      
      purchases: {
        box20: euData.box20,
        box21: euData.box21,
        box22: 0,
        box23: 0,
        box24: 0,
      },
      
      taxFree: {
        box35: taxFreeData.box35,
        box36: taxFreeData.box36,
        box37: 0,
        box38: taxFreeData.box38,
        box39: 0,
        box40: 0,
        box41: 0,
        box42: taxFreeData.box42,
      },
      
      summary: {
        box48: totalInputVAT,
        box49: totalOutputVAT,
        box50: netVAT,
      },
      
      calculated: {
        totalOutputVAT,
        totalInputVAT,
        netVAT,
        taxableBase: salesData.box05 + euData.box20 + euData.box21,
      },
      
      details: {
        salesItems: salesData.items,
        purchaseItems: purchaseData.items,
        euPurchaseItems: euData.purchaseItems,
        euSalesItems: euData.salesItems,
      },
      
      status: errors.length > 0 ? 'draft' : 'validated',
      validationWarnings: warnings,
      validationErrors: errors,
      
      generatedAt: new Date().toISOString(),
    };
    
    // Spara declaration
    this.declarations.set(declaration.id, declaration);
    
    return declaration;
  }
  
  /**
   * Hämta alla deklarationer för ett företag
   */
  async getDeclarations(companyId: string): Promise<VATDeclarationSummary[]> {
    const summaries: VATDeclarationSummary[] = [];
    
    this.declarations.forEach((decl) => {
      if (decl.companyId === companyId) {
        summaries.push({
          period: decl.period.label,
          outputVAT: decl.calculated.totalOutputVAT,
          inputVAT: decl.calculated.totalInputVAT,
          netVAT: decl.calculated.netVAT,
          status: decl.status,
          documentCount: 
            decl.details.salesItems.length + 
            decl.details.purchaseItems.length +
            decl.details.euPurchaseItems.length,
        });
      }
    });
    
    return summaries.sort((a, b) => b.period.localeCompare(a.period));
  }
  
  /**
   * Generera Skatteverket XML-format
   */
  generateSKVXML(declaration: VATDeclaration): string {
    // Skatteverket XML format för momsdeklaration
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Skatteverket xmlns="http://xmls.skatteverket.se/se/skatteverket/ai/instans/infoforesk498/2024.1"
              xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Avsandare>
    <Programnamn>AIFM Platform</Programnamn>
    <Organisationsnummer>${declaration.organisationNumber}</Organisationsnummer>
    <TekniskKontaktperson>
      <Namn>AIFM Support</Namn>
      <Telefon>08-123 456 78</Telefon>
      <Epostadress>support@aifm.se</Epostadress>
    </TekniskKontaktperson>
    <Skapad>${new Date().toISOString()}</Skapad>
  </Avsandare>
  <Blankettgemensamt>
    <Uppgiftslamnare>
      <UppgsijuridiskPerson>
        <UppgijuridiskForm>AB</UppgijuridiskForm>
        <Organisationsnummer>${declaration.organisationNumber}</Organisationsnummer>
        <Foretamn>${declaration.companyName}</Foretamn>
      </UppgijuridiskPerson>
    </Uppgiftslamnare>
  </Blankettgemensamt>
  <Blankett>
    <Aession uppgl="194" bession="1">
      <InsAr>${declaration.period.year}</InsAr>
      <InsPeriod>${declaration.period.month ? String(declaration.period.month).padStart(2, '0') : declaration.period.quarter ? `Q${declaration.period.quarter}` : '00'}</InsPeriod>
    </Aession>
    <Blankettinnehall>
      <Momsdekl>
        <!-- Försäljning -->
        <MomsF05>${Math.round(declaration.sales.box05)}</MomsF05>
        <MomsF06>${Math.round(declaration.sales.box06)}</MomsF06>
        <MomsF07>${Math.round(declaration.sales.box07)}</MomsF07>
        <MomsF08>${Math.round(declaration.sales.box08)}</MomsF08>
        
        <!-- Utgående moms -->
        <MomsUtg25>${Math.round(declaration.sales.box10)}</MomsUtg25>
        <MomsUtg12>${Math.round(declaration.sales.box11)}</MomsUtg12>
        <MomsUtg6>${Math.round(declaration.sales.box12)}</MomsUtg6>
        
        <!-- EU-förvärv -->
        <MomsEUVaror>${Math.round(declaration.purchases.box20)}</MomsEUVaror>
        <MomsEUTjanster>${Math.round(declaration.purchases.box21)}</MomsEUTjanster>
        <MomsInkopV>${Math.round(declaration.purchases.box22)}</MomsInkopV>
        <MomsInkopT>${Math.round(declaration.purchases.box23)}</MomsInkopT>
        <MomsImport>${Math.round(declaration.purchases.box24)}</MomsImport>
        
        <!-- Momsfri omsättning -->
        <MomsFriVarorEU>${Math.round(declaration.taxFree.box35)}</MomsFriVarorEU>
        <MomsFriExport>${Math.round(declaration.taxFree.box36)}</MomsFriExport>
        <MomsFriMellanman>${Math.round(declaration.taxFree.box37)}</MomsFriMellanman>
        <MomsFriTjansterEU>${Math.round(declaration.taxFree.box38)}</MomsFriTjansterEU>
        <MomsFriOvrig>${Math.round(declaration.taxFree.box39)}</MomsFriOvrig>
        <MomsFriKopareSve>${Math.round(declaration.taxFree.box40)}</MomsFriKopareSve>
        <MomsFriGuld>${Math.round(declaration.taxFree.box41)}</MomsFriGuld>
        <MomsFriOvrigOms>${Math.round(declaration.taxFree.box42)}</MomsFriOvrigOms>
        
        <!-- Summering -->
        <MomsIngAvdrag>${Math.round(declaration.summary.box48)}</MomsIngAvdrag>
        <MomsUtgSumma>${Math.round(declaration.summary.box49)}</MomsUtgSumma>
        <MomsAttBetala>${Math.round(declaration.summary.box50)}</MomsAttBetala>
      </Momsdekl>
    </Blankettinnehall>
  </Blankett>
</Skatteverket>`;
    
    return xml;
  }
  
  /**
   * Generera PDF-format för utskrift
   */
  generatePDFData(declaration: VATDeclaration): object {
    return {
      title: 'Momsdeklaration',
      subtitle: declaration.period.label,
      company: {
        name: declaration.companyName,
        orgNumber: declaration.organisationNumber,
      },
      sections: [
        {
          title: 'Momspliktig försäljning',
          rows: [
            { label: '05. Försäljning exkl. moms', value: declaration.sales.box05 },
            { label: '06. Momspliktiga uttag', value: declaration.sales.box06 },
            { label: '07. Vinstmarginalbeskattning', value: declaration.sales.box07 },
            { label: '08. Hyresinkomster', value: declaration.sales.box08 },
          ],
        },
        {
          title: 'Utgående moms',
          rows: [
            { label: '10. Utgående moms 25%', value: declaration.sales.box10 },
            { label: '11. Utgående moms 12%', value: declaration.sales.box11 },
            { label: '12. Utgående moms 6%', value: declaration.sales.box12 },
          ],
        },
        {
          title: 'EU-förvärv',
          rows: [
            { label: '20. Varor från EU', value: declaration.purchases.box20 },
            { label: '21. Tjänster från EU', value: declaration.purchases.box21 },
          ],
        },
        {
          title: 'Momsfri omsättning',
          rows: [
            { label: '35. Varor till EU', value: declaration.taxFree.box35 },
            { label: '36. Export utanför EU', value: declaration.taxFree.box36 },
            { label: '38. Tjänster till EU', value: declaration.taxFree.box38 },
            { label: '42. Övrig momsfri', value: declaration.taxFree.box42 },
          ],
        },
        {
          title: 'Summering',
          rows: [
            { label: '48. Ingående moms', value: declaration.summary.box48, highlight: true },
            { label: '49. Utgående moms', value: declaration.summary.box49, highlight: true },
            { 
              label: declaration.summary.box50 >= 0 ? '50. Moms att betala' : '50. Moms att få tillbaka', 
              value: Math.abs(declaration.summary.box50),
              highlight: true,
              negative: declaration.summary.box50 < 0,
            },
          ],
        },
      ],
      generatedAt: declaration.generatedAt,
    };
  }
  
  /**
   * Beräkna period
   */
  private calculatePeriod(year: number, month?: number, quarter?: number): VATDeclaration['period'] {
    const months = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
    
    if (month) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      return {
        year,
        month,
        type: 'monthly',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        label: `${months[month - 1]} ${year}`,
      };
    }
    
    if (quarter) {
      const startMonth = (quarter - 1) * 3;
      const startDate = new Date(year, startMonth, 1);
      const endDate = new Date(year, startMonth + 3, 0);
      return {
        year,
        quarter,
        type: 'quarterly',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        label: `Q${quarter} ${year}`,
      };
    }
    
    return {
      year,
      type: 'yearly',
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      label: `${year}`,
    };
  }
  
  /**
   * Hämta verifikationer för period
   * Not: Fortnox API begränsningar - använder mock data för demonstration
   */
  private async getVouchersForPeriod(
    companyId: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    // TODO: Implementera faktisk hämtning från Fortnox när voucher API är tillgängligt
    // Fortnox kräver speciell behörighet för voucher-läsning
    
    // Return mock data för demonstration
    return this.generateMockVouchers(startDate, endDate);
  }
  
  /**
   * Beräkna försäljningsmoms
   */
  private calculateSalesVAT(vouchers: any[]): {
    box05: number;
    box10: number;
    box11: number;
    box12: number;
    items: VATDetailItem[];
  } {
    let box05 = 0, box10 = 0, box11 = 0, box12 = 0;
    const items: VATDetailItem[] = [];
    
    // Kontoserie 26xx är utgående moms
    const vatAccounts = {
      '2610': 0.25,  // 25%
      '2611': 0.25,
      '2620': 0.12,  // 12%
      '2621': 0.12,
      '2630': 0.06,  // 6%
      '2631': 0.06,
    };
    
    vouchers.forEach(voucher => {
      const rows = voucher.VoucherRows || voucher.rows || [];
      rows.forEach((row: any) => {
        const account = row.Account || row.account || '';
        const credit = row.Credit || row.credit || 0;
        
        if (account in vatAccounts && credit > 0) {
          const rate = vatAccounts[account as keyof typeof vatAccounts];
          const netAmount = credit / rate;
          
          if (rate === 0.25) {
            box10 += credit;
            box05 += netAmount;
          } else if (rate === 0.12) {
            box11 += credit;
            box05 += netAmount;
          } else if (rate === 0.06) {
            box12 += credit;
            box05 += netAmount;
          }
          
          items.push({
            date: voucher.TransactionDate || voucher.date || '',
            customer: voucher.Description || '',
            description: row.Description || 'Försäljning',
            netAmount,
            vatAmount: credit,
            vatRate: rate * 100,
            vatAccount: account,
            type: 'sale',
          });
        }
      });
    });
    
    return { box05: Math.round(box05), box10, box11, box12, items };
  }
  
  /**
   * Beräkna inköpsmoms
   */
  private calculatePurchaseVAT(vouchers: any[]): {
    inputVAT: number;
    items: VATDetailItem[];
  } {
    let inputVAT = 0;
    const items: VATDetailItem[] = [];
    
    // Konto 2640 är ingående moms
    vouchers.forEach(voucher => {
      const rows = voucher.VoucherRows || voucher.rows || [];
      rows.forEach((row: any) => {
        const account = row.Account || row.account || '';
        const debit = row.Debit || row.debit || 0;
        
        if (account === '2640' && debit > 0) {
          inputVAT += debit;
          
          items.push({
            date: voucher.TransactionDate || voucher.date || '',
            supplier: voucher.Description || '',
            description: row.Description || 'Inköp',
            netAmount: debit / 0.25, // Uppskattar 25%
            vatAmount: debit,
            vatRate: 25,
            vatAccount: account,
            type: 'purchase',
          });
        }
      });
    });
    
    return { inputVAT, items };
  }
  
  /**
   * Beräkna EU-moms (förvärv och försäljning)
   */
  private calculateEUVAT(vouchers: any[]): {
    box20: number;
    box21: number;
    euInputVAT: number;
    purchaseItems: VATDetailItem[];
    salesItems: VATDetailItem[];
  } {
    let box20 = 0, euInputVAT = 0;
    const box21 = 0;
    const purchaseItems: VATDetailItem[] = [];
    const salesItems: VATDetailItem[] = [];
    
    // Konto 2645 är ingående moms EU-förvärv
    // Konto 2614/2615 är utgående moms EU-försäljning
    vouchers.forEach(voucher => {
      const rows = voucher.VoucherRows || voucher.rows || [];
      rows.forEach((row: any) => {
        const account = row.Account || row.account || '';
        const debit = row.Debit || row.debit || 0;
        
        if (account === '2645' && debit > 0) {
          euInputVAT += debit;
          box20 += debit / 0.25;
          
          purchaseItems.push({
            date: voucher.TransactionDate || voucher.date || '',
            supplier: voucher.Description || '',
            description: row.Description || 'EU-förvärv',
            netAmount: debit / 0.25,
            vatAmount: debit,
            vatRate: 25,
            vatAccount: account,
            type: 'eu_purchase',
            country: 'EU',
          });
        }
      });
    });
    
    return { box20: Math.round(box20), box21, euInputVAT, purchaseItems, salesItems };
  }
  
  /**
   * Beräkna momsfri omsättning
   */
  private calculateTaxFreeVAT(vouchers: any[]): {
    box35: number;
    box36: number;
    box38: number;
    box42: number;
  } {
    // Kontoserie 30xx-37xx är intäkter
    // Analysera beskrivningar för att avgöra typ
    let box35 = 0, box36 = 0, box38 = 0, box42 = 0;
    
    vouchers.forEach(voucher => {
      const rows = voucher.VoucherRows || voucher.rows || [];
      const description = (voucher.Description || '').toLowerCase();
      
      rows.forEach((row: any) => {
        const account = row.Account || row.account || '';
        const credit = row.Credit || row.credit || 0;
        
        // Kontoserie 3xxx är intäkter
        if (account.startsWith('3') && credit > 0) {
          // Ingen moms = potentiellt momsfritt
          const hasVAT = rows.some((r: any) => 
            (r.Account || r.account || '').startsWith('26') && (r.Credit || r.credit || 0) > 0
          );
          
          if (!hasVAT) {
            if (description.includes('eu') || description.includes('europa')) {
              if (description.includes('tjänst') || description.includes('service')) {
                box38 += credit;
              } else {
                box35 += credit;
              }
            } else if (description.includes('export') || description.includes('utland')) {
              box36 += credit;
            } else {
              box42 += credit;
            }
          }
        }
      });
    });
    
    return { box35, box36, box38, box42 };
  }
  
  /**
   * Validera deklarationen
   */
  private validateDeclaration(data: {
    sales: any;
    purchases: any;
    euData: any;
    taxFreeData: any;
    totalOutputVAT: number;
    totalInputVAT: number;
    netVAT: number;
  }): { warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];
    
    // Kontrollera att belopp är rimliga
    if (data.totalInputVAT > data.totalOutputVAT * 2) {
      warnings.push('Ingående moms är mycket högre än utgående moms - kontrollera underlag');
    }
    
    if (data.sales.box05 < 0) {
      errors.push('Försäljningsbelopp kan inte vara negativt');
    }
    
    if (data.totalInputVAT < 0) {
      errors.push('Ingående moms kan inte vara negativ');
    }
    
    // Varning för stora belopp
    if (Math.abs(data.netVAT) > 1000000) {
      warnings.push('Stort momsbelopp - vänligen verifiera');
    }
    
    // Kontrollera EU-handel
    if (data.euData.box20 > 0 && data.taxFreeData.box35 === 0) {
      warnings.push('EU-inköp finns men ingen EU-försäljning rapporteras');
    }
    
    return { warnings, errors };
  }
  
  /**
   * Mock-data för testning
   */
  private generateMockVouchers(startDate: string, endDate: string): any[] {
    return [
      {
        TransactionDate: startDate,
        Description: 'Konsultintäkt',
        VoucherRows: [
          { Account: '1930', Debit: 125000 },
          { Account: '3010', Credit: 100000 },
          { Account: '2610', Credit: 25000 },
        ],
      },
      {
        TransactionDate: startDate,
        Description: 'Leverantörsfaktura - Kontorsmaterial',
        VoucherRows: [
          { Account: '6110', Debit: 4000 },
          { Account: '2640', Debit: 1000 },
          { Account: '2440', Credit: 5000 },
        ],
      },
      {
        TransactionDate: startDate,
        Description: 'Leverantörsfaktura - IT-tjänster',
        VoucherRows: [
          { Account: '6540', Debit: 20000 },
          { Account: '2640', Debit: 5000 },
          { Account: '2440', Credit: 25000 },
        ],
      },
    ];
  }
}

export const vatDeclarationService = new VATDeclarationService();

