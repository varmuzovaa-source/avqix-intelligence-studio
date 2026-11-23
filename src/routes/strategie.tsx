import { createFileRoute } from '@tanstack/react-router';
import { StrategyPage } from '@/components/analytics/strategy-page';
import { pageHead } from '@/lib/analytics-data';
export const Route=createFileRoute('/strategie')({head:()=>pageHead('Strategie & integrace','Multikanálový marketingový přehled a doporučení.'),component:StrategyPage});
