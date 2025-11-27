import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * AI Chat API - DEMO MODE
 * Returns mock responses for demonstration purposes
 * Replace with real OpenAI integration when going to production
 */

const MOCK_RESPONSES: Record<string, string> = {
  default: `Hej! Jag är AIFM Assistant i demo-läge. 

I produktionsversionen kan jag hjälpa dig med:
- Analysera uppgifter och rapporter
- Svara på frågor om systemet
- Ge rekommendationer baserat på data
- Förklara arbetsflöden

Just nu visar jag demo-svar. Kontakta administratören för att aktivera full AI-funktionalitet.`,

  tasks: `📋 **Uppgiftsöversikt (Demo)**

Jag kan se att du har flera uppgifter i systemet. I produktionsläge skulle jag kunna:
- Prioritera uppgifter baserat på deadline
- Identifiera flaskhalsar
- Föreslå åtgärder för försenade uppgifter

*Detta är ett demo-svar.*`,

  reports: `📊 **Rapportanalys (Demo)**

I produktionsläge kan jag:
- Sammanfatta rapporter
- Jämföra med tidigare perioder
- Identifiera avvikelser
- Generera nya rapporter

*Detta är ett demo-svar.*`,

  help: `❓ **Hjälp & Support**

Tillgängliga kommandon:
- "visa uppgifter" - Lista aktiva uppgifter
- "rapportstatus" - Visa rapportöversikt
- "compliance" - Kontrollera efterlevnad

*Demo-läge aktivt.*`,
};

function getMockResponse(message: string, context: any): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('uppgift') || lowerMessage.includes('task')) {
    return MOCK_RESPONSES.tasks + `\n\n📈 Aktuell statistik:\n- Totala uppgifter: ${context.taskCount}\n- Rapporter: ${context.reportCount}\n- Klienter: ${context.clientCount}`;
  }
  
  if (lowerMessage.includes('rapport') || lowerMessage.includes('report')) {
    return MOCK_RESPONSES.reports;
  }
  
  if (lowerMessage.includes('hjälp') || lowerMessage.includes('help')) {
    return MOCK_RESPONSES.help;
  }
  
  return MOCK_RESPONSES.default + `\n\n📈 Systemstatus:\n- ${context.taskCount} uppgifter\n- ${context.reportCount} rapporter\n- ${context.clientCount} klienter`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Get system context for the response
    let taskCount = 0, reportCount = 0, clientCount = 0;
    try {
      [taskCount, reportCount, clientCount] = await Promise.all([
        prisma.task.count(),
        prisma.report.count(),
        prisma.client.count(),
      ]);
    } catch (dbError) {
      console.error('Database error in chat:', dbError);
      // Continue with zeros if DB fails
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const response = getMockResponse(message, {
      taskCount,
      reportCount,
      clientCount,
    });

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: `Failed to process chat message: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
