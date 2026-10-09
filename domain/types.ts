export interface Activity {id:string;name:string;predecessors:string[];duration_cpm:number;a:number;m:number;b:number;progress?:number;actual_duration?:number;actual_start?:number;actual_finish?:number;}
export interface Product {id:string;name:string;unit:string;annual_demand:number;unit_cost:number;order_cost:number;holding_rate:number;holding_cost:number;lead_time_days:number;safety_stock:number;stock:number;order_multiple:number;eoq_eligible:boolean;baseline_order_quantity:number|null;capacity:number|null;supplier_id:string;supply_policy:string;}
export interface Requirement {activity_id:string;product_id:string;quantity:number;}
export interface Supplier {id:string;name:string;simulated:boolean;}
export interface Project {id:string;name:string;activities:Activity[];requirements:Requirement[];control_day?:number;}
export interface Movement {id:string;product_id:string;kind:'entry'|'exit';quantity:number;reason:string;created_at:string;stock_after:number;}
export interface AppState {revision:number;company:string;operating_days:number;projects:Project[];products:Product[];suppliers:Supplier[];movements:Movement[];}
export interface ScheduleRow extends Activity {duration:number;es:number;ef:number;ls:number;lf:number;slack:number;critical:boolean;variance:number;level:number;}
export interface Schedule {duration:number;rows:ScheduleRow[];paths:string[][];pathsTruncated:boolean;}
