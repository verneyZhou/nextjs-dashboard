'use server'; // 将文件内的所有导出函数标记为服务器操作。然后可以导入这些服务器函数并将其用于客户端和服务器组件。


import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

// 登录校验
export async function authenticate(formData: FormData) {
    console.log('=====authenticate', formData);
    try {
      await signIn('credentials', formData);
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case 'CredentialsSignin':
            return 'Invalid credentials.';
          default:
            return 'Something went wrong.';
        }
      }
      throw error;
    }
  }



 
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
});
 
const CreateInvoice = FormSchema.omit({ id: true, date: true });

// 创建发票
export async function createInvoice(formData: FormData) {
    const { customerId, amount, status } = CreateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
      });
      const amountInCents = amount * 100; // 换算成美分, 可以消除 JavaScript 浮点错误
      const date = new Date().toISOString().split('T')[0];

      try {
        //  插入数据
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
      } catch (error) {
        return {
          message: 'Database Error: Failed to Create Invoice.',
        };
      }
    
    // Next.js 有一个客户端路由器缓存，可将路由段暂时存储在用户的浏览器中。除了预取之外，此缓存还可确保用户可以在路由之间快速导航，同时减少对服务器发出的请求数量。
    // 由于您正在更新发票路线中显示的数据，因此您需要清除此缓存并触发对服务器的新请求。您可以使用revalidatePath来执行此操作
    revalidatePath('/dashboard/invoices'); // 一旦数据库更新，/dashboard/invoices 路径将重新验证，并从服务器获取新数据。

    redirect('/dashboard/invoices'); // 重定向回来
}



// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });
// 编辑发票 
export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
 
  const amountInCents = amount * 100;

  try {
    await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
    `;
  } catch(err) {
    return {
      message: 'Database Error: Failed to Update Invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}



export async function deleteInvoice(id: string) {
    // throw new Error('Failed to Delete Invoice');

    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
        return { message: 'Deleted Invoice.' };
    } catch (error) {
        return { message: 'Database Error: Failed to Delete Invoice.' };
    }
}


