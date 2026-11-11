import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={title:"ABBIS Source Sandbox | TrustLedger",description:"Synthetic blood-bank system sending genuine API requests to TrustLedger",robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){
return <html lang="en"><body>{children}</body></html>;
}
